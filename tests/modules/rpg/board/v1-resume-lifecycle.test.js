// What a v1 fight resumes (resume-v1.js reads the chat's receipts) is the same live, after a rebuild and after a reload, and follows the receipts through a swipe, swipe back,
// an edited Re-read (grown and shrunk), a rewind, a middle delete and a chat change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { resumeFoesV1 } from '../../../../modules/rpg/board/resume-v1.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { resumeKit } from './v1-resume.helpers.js';

test('the foes a fled v1 fight left resume the same live, rebuilt and reloaded, and follow the receipts through every chat change', async t => {
    const restore = seedCrypto(5);
    t.after(restore);
    const kit = await resumeKit(t, { count: 3, level: 5 });
    const { host } = kit;
    const resumeNow = () => {
        const sheet = readSheet({ domains: { dataModules: host.head().domains.dataModules, inventory: host.head().domains.inventory, scene: host.head().domains.scene } });
        return resumeFoesV1(host.store.receipts(), sheet.foes.filter(foe => foe.v1 === true && foe.filled));
    };
    const same = async label => {
        const live = JSON.stringify([host.head(), resumeNow()]);
        host.store.rebuild();
        assert.equal(JSON.stringify([host.head(), resumeNow()]), live, `${label}: live == rebuild`);
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, `resume-${label}`);
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify([host.head(), resumeNow()]), live, `${label}: reload == live`);
    };
    const group = async () => { for (const [field, value] of [['foe1', 'Rats'], ['count1', 3], ['level1', 5]]) await host.sdk.command('test.set', { slug: 'foes', field, value }); };
    assert.equal(kit.board.open(), true);
    kit.play('normal', 1);
    assert.equal(kit.play('flee'), 'fled');
    await host.send('Fight and run.', 'Away they go.');
    await group();
    await host.send('They come again.', 'The same foes stand again.');
    const resumed = resumeNow();
    assert.ok(resumed?.foes.some(foe => foe.hp < 10), 'the fled fight left a hurt foe, and the same group resumes it');
    await same('first');

    const text = host.ctx.chat[4].mes;
    await host.swipe('Told again.');
    assert.deepEqual(resumeNow(), resumed, 'a swipe of the later reply keeps the fled fight\'s bars');
    await same('swipe');
    await host.st.swipeTo(4, 0);
    assert.deepEqual(resumeNow(), resumed, 'swipe back');
    await same('swipe back');
    for (const [label, mes] of [['grown', `${text} A line the story added.`], ['shrunk', text]]) {
        await host.st.editMessage(4, mes);
        assert.equal((await host.sdk.reread(4)).ok, true);
        assert.deepEqual(resumeNow(), resumed, `Re-read (${label}) of the later reply`);
        await same(`re-read ${label}`);
    }
    // an edited Re-read of the FIGHT's own reply keeps its settle: the bars stay
    const fightText = host.ctx.chat[2].mes;
    await host.st.editMessage(2, `${fightText} More story.`);
    assert.equal((await host.sdk.reread(2)).ok, true);
    assert.deepEqual(resumeNow(), resumed, 'Re-read (grown) of the fight reply');
    await host.st.editMessage(2, fightText);
    assert.equal((await host.sdk.reread(2)).ok, true);
    assert.deepEqual(resumeNow(), resumed, 'Re-read (shrunk) of the fight reply');
    await same('re-read fight reply');

    // a rewind to before the fight's settle, and a middle delete of the fight's pair: no receipt, no resume
    const entry = host.store.receipts().find(item => item.index === 2 && item.receipt.type === 'interaction.settle');
    assert.ok(entry);
    assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
    assert.equal(resumeNow(), null, 'a rewind past the fight takes its bars back');
    await same('rewind');
    await host.st.deleteMessage(2);
    await host.st.deleteMessage(1);
    assert.equal(resumeNow(), null, 'a middle delete of the fight takes its bars back');
    await same('middle delete');
    const keptChat = structuredClone(host.ctx.chat), keptMeta = structuredClone(host.ctx.chatMetadata), keptState = JSON.stringify([host.head(), resumeNow()]);
    host.ctx.chatMetadata = {};
    await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Another story.', extra: {} }], 'another-chat');
    assert.equal(resumeNow(), null, 'another chat resumes nothing');
    host.ctx.chatMetadata = keptMeta;
    await host.st.loadChat(keptChat, 'resume-back');
    assert.equal(JSON.stringify([host.head(), resumeNow()]), keptState, 'switching back: as it was');
});
