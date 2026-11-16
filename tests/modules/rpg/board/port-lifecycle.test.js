// A fight on the port lives through every way a chat changes: after each step the live state equals a cold rebuild (and a reload of the saved chat), and the fight's recorded rounds never move.
// Steps: two replies carry one exchange each; swipe; swipe back; Re-read of an edited reply (grown, then shrunk); rewind; a middle delete; a chat change and back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { boardApi, boardSession, openBoard, stageExchange } from '../../../core/helpers/board-port.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { character, foeBlock, rollReceipt, setup, skillBlock } from '../helpers.js';

const FIGHT = {
    hero: { role: 'character', fields: character('Astra', { str: 20, agi: 20, stamina: 4 }) },
    skills: { role: 'skills', fields: skillBlock('Astra', [['Cut', 3, 'str', 'stamina', 'strike one foe']]) },
    foes: { role: 'foes', fields: foeBlock([['Rats', 3, 1, 5]]) },
};
const RULES = { ...STANDARD_FORMULA, levelDivisor: 5 };
const ACTION = [{ who: 'Astra', kind: 'skill', skill: 'Cut', target: 11 }];
const fightIn = (host, index) => rollReceipt(host, index);
const roundsAt = (host, index) => fightIn(host, index)?.data?.v2?.result?.rounds;

test('a fight on the port replays as live across swipe, swipe back, edited Re-read, rewind, middle delete, reload and chat change', async () => {
    const restore = seedCrypto(77);
    const { host, callModel } = await setup({ blocks: FIGHT, board: true });
    // The Fight tab's view (the kind's `view`, what `interaction.view` answers) is the same live, after a rebuild and after a reload.
    const viewOf = () => (host.ctx.chatMetadata.storySuiteInteraction?.open ? JSON.stringify(boardApi(host.ctx.chatMetadata, () => host.head(), host.store.carrierSid(host.store.headIndex())).current()?.view ?? null) : null);
    const same = async label => {
        const live = JSON.stringify(host.head()), liveView = viewOf();
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, `${label}: live == rebuild`);
        assert.equal(viewOf(), liveView, `${label}: view live == rebuild`);
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, `lifecycle-${label}`);
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(host.head()), live, `${label}: reload == live`);
        assert.equal(viewOf(), liveView, `${label}: view reload == live`);
    };
    try {
        // (a reload replaces the chat's metadata object: it is read again each time)
        const sid = host.store.carrierSid(host.store.headIndex());
        assert.equal(openBoard(host.ctx.chatMetadata, host.head(), { sid, rules: RULES }).error, undefined);
        assert.equal(stageExchange(host.ctx.chatMetadata, host.head(), ACTION).error, undefined);
        await host.send('First.', 'One.');
        const first = structuredClone(roundsAt(host, 2));
        assert.equal(fightIn(host, 2).type, 'interaction.settle', 'the fight is settled by the core');
        assert.equal(fightIn(host, 2).data.v2.result.stop, 'open');
        await same('first reply');

        const carried = boardSession(host.ctx.chatMetadata);
        assert.ok(carried, 'the open fight carries on to the next segment');
        assert.equal(stageExchange(host.ctx.chatMetadata, host.head(), ACTION).error, undefined);
        await host.send('Second.', 'Two.');
        const second = structuredClone(roundsAt(host, 4));
        assert.ok(second?.length, 'the second reply carries the fight\'s next segment');
        assert.equal(fightIn(host, 4).type, 'interaction.settle');
        assert.notDeepEqual(second, first);
        await same('second reply');

        const beforeSwipe = JSON.stringify(host.head());
        await host.swipe('Told again.');
        assert.deepEqual(roundsAt(host, 4), second, 'a swipe settles the same fight again');
        await same('swipe');
        await host.st.swipeTo(4, 0);
        assert.equal(JSON.stringify(host.head()), beforeSwipe, 'swipe back: the state before the swipe');
        await same('swipe back');

        // an edited Re-read: the reply's text grows by a story line, then shrinks back; the fight stays the recorded one
        const text = host.ctx.chat[4].mes;
        await host.st.editMessage(4, `${text}\n<Changes>\n+ dm foes — why | kind: set-slot-2 | name: Wolves | count: 1 | level: 3\n</Changes>`);
        assert.equal((await host.sdk.reread(4)).ok, true);
        assert.deepEqual(roundsAt(host, 4), second, 'Re-read (grown) keeps the rounds');
        await same('re-read grown');
        await host.st.editMessage(4, text);
        assert.equal((await host.sdk.reread(4)).ok, true);
        assert.deepEqual(roundsAt(host, 4), second, 'Re-read (shrunk) keeps the rounds');
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
        assert.equal(boardSession(host.ctx.chatMetadata), null, 'no fight in the other chat');
        assert.equal(host.ctx.chatMetadata.storySuiteInteraction, undefined, 'and no hold or scratch');
        assert.notEqual(JSON.stringify(host.head()), keptState, 'the other chat has its own state');
        host.ctx.chatMetadata = keptMeta;
        await host.st.loadChat(keptChat, 'lifecycle-back');
        assert.equal(JSON.stringify(host.head()), keptState, 'switching back: the first chat as it was');
        assert.equal(callModel.calls.length, 0, 'no model call anywhere');
    } finally { host.close(); restore(); }
});
