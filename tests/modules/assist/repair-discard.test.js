// CHGFIX3: the repair is ON by default; "Discard repair" takes a reply's repaired lines out of its text, reads the reply again and keeps the discard in the text,
// so a swipe back, a reload, a Re-read, a middle delete and a rewind replay it and the repair is never asked again for that reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistSections, repairState, withAssist, withoutRepair } from '../../../core/capture.js';
import { createDiscard } from '../../../core/turn/discard.js';
import { readRecord } from '../../../core/persist.js';
import { createRepairer, createRunLog, SETTING } from '../../../modules/assist/index.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

const BLOCKLESS = 'You pay Bob five coins, take a rope and walk to the old mill.';
const ANSWER = '<Changes>\n+ coin 30 | from: Bob\n+ item Rope | qty: 1\n~ place Old Mill | kind: settlement\n</Changes>';
const NET = ['+ item Lamp | qty: 1'];

async function host({ settings = undefined } = {}) {
    const calls = [];
    const h = await createHost({ realDefaults: true, callModel: async (prompt, options) => { calls.push({ prompt, options }); return ANSWER; }, ...(settings ? { settings } : {}) });
    h.calls = calls;
    return h;
}
const wallet = h => h.sdk.query('inventory.wallet')?.coin ?? 0;
const ropes = h => (h.sdk.query('inventory.items') ?? []).filter(item => item.name === 'Rope').reduce((sum, item) => sum + item.qty, 0);
const state = h => [wallet(h), ropes(h), h.sdk.query('scene.place')?.name ?? ''];
const REPAIRED = [30, 1, 'Old Mill'];

test('the repair is on by default: nothing stored in the settings, a reply with no block is repaired once and its lines are marked as the repair\'s', { skip }, async () => {
    const h = await host();
    const turn = await h.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(h.calls.length, 1, 'asked with no setting stored');
    assert.deepEqual(state(h), REPAIRED);
    assert.equal(repairState(h.ctx.chat[turn.index].mes), 'repaired');
    assert.equal(h.sdk.query('assist.status')?.repair?.on, true);
    // The reply's changes mark every line the repair wrote as Assist's (from the receipts, so a reload gives the same).
    const own = await h.send('Next.', 'A dog barks.\n<Changes>\n+ item Lamp\n</Changes>');
    const repaired = h.sdk.query('reply.changes', { index: turn.index });
    assert.ok(repaired.lines.length >= 3 && repaired.lines.every(line => line.assist === true), JSON.stringify(repaired.lines));
    const plain = h.sdk.query('reply.changes', { index: own.index });
    assert.ok(plain.lines.length === 1 && plain.lines[0].assist === false, 'the reply\'s own line is not marked');
    h.close();
});

test('Discard repair: the lines go, the text keeps the mark, the repair is not asked again after a Re-read, a reload or a swipe back', { skip }, async () => {
    const h = await host();
    const first = await h.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.deepEqual(state(h), REPAIRED);
    const message = h.ctx.chat[first.index];
    const out = await h.sdk.reread(first.index, { discardRepair: true });
    assert.equal(out.ok, true, JSON.stringify(out));
    await wait(40);
    assert.deepEqual(state(h), [0, 0, ''], 'the repaired lines are gone from the story');
    assert.equal(repairState(message.mes), 'discarded');
    assert.equal(message.swipes[message.swipe_id], message.mes, 'the swipe holds it too');
    assert.deepEqual(assistSections(message.mes).now, []);
    assert.equal(readRecord(message).receipts.length, 0, 'no receipt of the repair is left');
    // Re-read, reload: replay the discard, no call.
    assert.equal((await h.sdk.reread(first.index)).ok, true);
    await h.turn.onChatChanged();
    await wait(40);
    assert.deepEqual(state(h), [0, 0, '']);
    assert.equal(h.calls.length, 1, 'the repair was not called again');
    // A swipe with a block of its own, then back to the discarded one: still discarded.
    await h.swipe('A new swipe.\n<Changes>\n+ present Dries\n</Changes>');
    await wait(30);
    await h.st.swipeTo(first.index, 0);
    await h.turn.onChatChanged();
    await wait(40);
    assert.deepEqual(state(h), [0, 0, ''], 'swipe back');
    assert.equal(repairState(h.ctx.chat[first.index].mes), 'discarded');
    assert.equal(h.calls.length, 1);
    h.close();
});

test('Discard repair on a reply with later replies: a middle delete, an edited Re-read (grown and shrunk), a chat change and a rewind keep it discarded', { skip }, async () => {
    const h = await host();
    const a = await h.send('I pay.', BLOCKLESS);
    await wait(30);
    const b = await h.send('Lamp.', 'A lamp.\n<Changes>\n+ item Lamp\n</Changes>');
    await h.send('Look.', 'Dust.\n<Changes>\n</Changes>');
    assert.equal((await h.sdk.reread(a.index, { discardRepair: true })).ok, true);
    await wait(30);
    const lamps = () => (h.sdk.query('inventory.items') ?? []).filter(item => item.name === 'Lamp').length;
    assert.deepEqual([...state(h), lamps()], [0, 0, '', 1], 'the later lamp stays, the repair is gone');
    const message = h.ctx.chat[a.index];
    for (const text of [`${BLOCKLESS}\n\nHe adds a long, rambling farewell.`, BLOCKLESS]) {
        const hidden = message.mes.slice(message.mes.indexOf('\n\n<!--'));
        message.mes = `${text}${hidden}`;
        message.swipes[message.swipe_id] = message.mes;
        assert.equal((await h.sdk.reread(a.index)).ok, true);
        assert.deepEqual([...state(h), lamps()], [0, 0, '', 1], 'edited Re-read');
        assert.equal(repairState(message.mes), 'discarded');
    }
    const saved = structuredClone(h.ctx.chat);
    await h.st.loadChat([{ is_user: false, name: 'N', mes: 'Elsewhere.' }], 'other');
    await h.st.loadChat(saved, 'main');
    await wait(30);
    assert.deepEqual([...state(h), lamps()], [0, 0, '', 1], 'chat change and back');
    const rev = readRecord(h.ctx.chat[b.index]).receipts[0].rev;
    assert.equal((await h.sdk.rewind({ index: b.index, beforeRev: rev })).ok, true);
    await wait(30);
    assert.deepEqual([...state(h), lamps()], [0, 0, '', 0], 'rewind');
    await h.st.loadChat(structuredClone(saved), 'main');
    await h.st.deleteMessage(b.index);
    await wait(30);
    assert.deepEqual(state(h), [0, 0, ''], 'middle delete');
    assert.equal(h.calls.length, 1, 'never a second call');
    h.close();
});

test('Discard repair refuses a reply with no repair and leaves it as it was', { skip }, async () => {
    const h = await host({ settings: { modules: { 'story-block': { assistRepair: false } } } });
    const turn = await h.send('I pay.', BLOCKLESS);
    await wait(30);
    const before = h.ctx.chat[turn.index].mes;
    const out = await h.sdk.reread(turn.index, { discardRepair: true });
    assert.equal(out.ok, false);
    assert.equal(h.ctx.chat[turn.index].mes, before);
    h.close();
});

test('withoutRepair takes out only the repair\'s comment and keeps the safety net\'s lines; it marks the discard once', () => {
    const net = withAssist('Story.', NET);
    const both = withAssist(net, ['+ item Rope | qty: 1'], { repair: true });
    assert.equal(repairState(both), 'repaired');
    assert.deepEqual(assistSections(both).now, [...NET, '+ item Rope | qty: 1']);
    const once = withoutRepair(both);
    assert.equal(repairState(once), 'discarded');
    assert.deepEqual(assistSections(once).now, NET, 'the safety net\'s lines stay');
    assert.equal(withoutRepair(once), once, 'discarding again changes nothing');
    assert.equal(repairState('Story.'), '');
});

test('when the Re-read refuses, the text is put back as it was; an edit made meanwhile is not overwritten', async () => {
    const mes = withAssist('Story.', ['+ item Rope | qty: 1'], { repair: true });
    const message = { mes, swipes: [mes], swipe_id: 0 };
    const refusal = (code, text) => ({ ok: false, code, message: text });
    const refuse = createDiscard({ ctx: { chat: [message] }, reread: async () => refusal('REFUSED', 'A reply is being written'), refusal });
    const out = await refuse.discardRepair(0);
    assert.equal(out.ok, false);
    assert.equal(message.mes, mes);
    assert.equal(message.swipes[0], mes);
    const edited = createDiscard({ ctx: { chat: [message] }, reread: async () => { message.mes = 'Edited.'; return refusal('CONFLICT', 'changed'); }, refusal });
    await edited.discardRepair(0);
    assert.equal(message.mes, 'Edited.');
});

test('a repairer that never saw the reply (a reload, a fresh page) does not ask for a reply whose text holds the discard mark', async () => {
    const discarded = withoutRepair(withAssist('You walk on.', ['+ item Rope | qty: 1'], { repair: true }));
    const calls = [];
    const make = () => createRepairer({ callModel: async () => { calls.push(1); return '<Changes>\n+ item Rope | qty: 1\n</Changes>'; }, settings: () => ({ [SETTING.repair]: true }), grammar: () => ['+ item Name'], capture: async () => null, chatId: () => 'c', log: createRunLog(), warn: () => {} });
    const reply = mes => ({ index: 3, swipe: 0, type: 'normal', mes, missing: true });
    assert.deepEqual(await make().afterReply(reply(discarded)), { attempted: false });
    assert.equal(calls.length, 0);
    assert.equal((await make().afterReply(reply('You walk on.'))).attempted, true, 'the same reply without the mark is asked');
    assert.equal(calls.length, 1);
});
