// A v1 fight on the port lives through every way a chat changes (the same steps as port-lifecycle.test.js, on a Combat Rules v1 sheet): after each step the live state
// equals a cold rebuild and a reload, and the fight's recorded lines never move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { rollReceipt } from '../helpers.js';
import { api, headSid, openFight, stage, step, v1Host } from './v1.helpers.js';

const linesAt = (host, index) => rollReceipt(host, index)?.data?.v2?.result?.lines;
const fightIn = (host, index) => rollReceipt(host, index);
const session = host => host.ctx.chatMetadata.storySuiteInteraction?.open ?? null;

test('a v1 fight on the port replays as live across swipe, swipe back, edited Re-read, rewind, middle delete, reload and chat change', async () => {
    const restore = seedCrypto(77);
    const { host, callModel } = await v1Host({ count: 5, level: 8 });
    const same = async label => {
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, `${label}: live == rebuild`);
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, `lifecycle-${label}`);
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(host.head()), live, `${label}: reload == live`);
    };
    try {
        // (a reload replaces the chat's metadata object: it is read again each time)
                assert.equal(openFight(host).ok, true);
        assert.equal(stage(host, step()).ok, true);
        await host.send('First.', 'One.');
        const first = structuredClone(linesAt(host, 2));
        assert.equal(fightIn(host, 2).type, 'interaction.settle', 'the fight is settled by the core');
        assert.equal(fightIn(host, 2).data.v2.result.stop, 'open');
        assert.equal(fightIn(host, 2).data.v2.result.board.v1, 1, 'the v1 engine played it');
        assert.equal(fightIn(host, 2).data.v2.result.exchanges, 1);
        const hp = () => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.hp;
        assert.ok(fightIn(host, 2).data.v2.result.hurts.length > 0, 'the first segment moved the party\'s bars (else the next check proves nothing)');
        assert.equal(hp(), fightIn(host, 2).data.v2.result.party[0].hp, 'the Character block holds the bar the fight left (not just the record)');
        await same('first reply');

        const carried = session(host);
        assert.ok(carried, 'the open fight carries on to the next segment');
        assert.equal(stage(host, step()).ok, true);
        await host.send('Second.', 'Two.');
        const second = structuredClone(linesAt(host, 4));
        assert.ok(second?.length, 'the second reply carries the fight\'s next segment');
        assert.equal(fightIn(host, 4).type, 'interaction.settle');
        assert.notDeepEqual(second, first);
        assert.equal(fightIn(host, 4).data.v2.result.exchanges, 2, 'the second segment goes on from the first one\'s exchange');
        assert.equal(session(host)?.setup.start.offset, 2, 'and carries its start on');
        await same('second reply');

        const beforeSwipe = JSON.stringify(host.head());
        await host.swipe('Told again.');
        assert.deepEqual(linesAt(host, 4), second, 'a swipe settles the same fight again');
        await same('swipe');
        await host.st.swipeTo(4, 0);
        assert.equal(JSON.stringify(host.head()), beforeSwipe, 'swipe back: the state before the swipe');
        await same('swipe back');

        // an edited Re-read: the reply's text grows by a story line, then shrinks back; the fight stays the recorded one
        const text = host.ctx.chat[4].mes;
        await host.st.editMessage(4, `${text}\n<Changes>\n+ dm foes — why | kind: set-slot-2 | name: Wolves | count: 1 | level: 3\n</Changes>`);
        assert.equal((await host.sdk.reread(4)).ok, true);
        assert.deepEqual(linesAt(host, 4), second, 'Re-read (grown) keeps the rounds');
        await same('re-read grown');
        await host.st.editMessage(4, text);
        assert.equal((await host.sdk.reread(4)).ok, true);
        assert.deepEqual(linesAt(host, 4), second, 'Re-read (shrunk) keeps the rounds');
        await same('re-read shrunk');

        // a rewind to before the second reply's fight, then the fight is played again
        const entry = host.store.receipts().filter(item => item.index === 4).find(item => item.receipt.type === 'interaction.settle');
        assert.ok(entry, 'the second reply holds its settle');
        assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
        await same('rewind');

        // a middle delete of the first pair: the later segment cannot follow its earlier one; replay still equals live
        await host.st.deleteMessage(2);
        await host.st.deleteMessage(1);
        await same('middle delete');
        // a real chat change: another chat with its own empty metadata shows no fight and no hold; switching back finds the fight's chat as it was
        const keptChat = structuredClone(host.ctx.chat), keptMeta = structuredClone(host.ctx.chatMetadata), keptState = JSON.stringify(host.head());
        host.ctx.chatMetadata = {};
        await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Another story.', extra: {} }], 'another-chat');
        assert.equal(session(host), null, 'no fight in the other chat');
        assert.equal(host.ctx.chatMetadata.storySuiteInteraction, undefined, 'and no hold or scratch');
        assert.notEqual(JSON.stringify(host.head()), keptState, 'the other chat has its own state');
        host.ctx.chatMetadata = keptMeta;
        await host.st.loadChat(keptChat, 'lifecycle-back');
        assert.equal(JSON.stringify(host.head()), keptState, 'switching back: the first chat as it was');
        assert.equal(callModel.calls.length, 0, 'no model call anywhere');
    } finally { host.close(); restore(); }
});
