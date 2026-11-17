// Repair on a miss (CHGDROP fix 1): a reply with no <Changes> block is repaired by one Quick call; its lines are stored in <Changes-assist> and replay
// identically (swipe, swipe back, middle delete, rewind, reload, Re-read, an edited Re-read) without a second call. Coin and items pass its wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistSections } from '../../../core/capture.js';
import { SETTING, refusedWhy } from '../../../modules/assist/index.js';
import { createRepairer, createRunLog } from '../../../modules/assist/index.js';
import { readRecord } from '../../../core/persist.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

const BLOCKLESS = 'You pay Bob five coins, take a rope and walk to the old mill.';
const ANSWER = '<Changes>\n+ coin 30 | from: Bob\n+ item Rope | qty: 1\n~ place Old Mill | kind: settlement\n</Changes>';

async function repairHost({ answer = ANSWER, repair = true, model = null } = {}) {
    const calls = [];
    const callModel = model ?? (async (prompt, options) => { calls.push({ prompt, options }); return answer; });
    const host = await createHost({ callModel, settings: { modules: { 'story-block': { [SETTING.repair]: repair } } } });
    host.calls = calls;
    return host;
}
const wallet = host => host.sdk.query('inventory.wallet')?.coin ?? 0;
const ropes = host => (host.sdk.query('inventory.items') ?? []).filter(item => item.name === 'Rope').reduce((sum, item) => sum + item.qty, 0);
const noChanges = host => host.turn.problems().filter(item => item.code === 'NO_CHANGES');

test('the wall: a repair may write coin and items, never XP, loot, rewards or heals; after send the strict wall stays', () => {
    const line = (op, kind, labels = {}) => ({ op, kind, name: 'x', labels });
    for (const item of [line('+', 'coin'), line('-', 'coin'), line('+', 'item'), line('-', 'item')]) assert.equal(refusedWhy(item, null, { repair: true }), '', `${item.op} ${item.kind}`);
    for (const item of [line('+', 'coin'), line('+', 'item')]) assert.notEqual(refusedWhy(item, null), '', 'the extractor still never writes them');
    for (const item of [line('+', 'xp'), line('+', 'loot'), line('+', 'reward'), line('?', 'item'), line('+', 'buy')]) assert.notEqual(refusedWhy(item, null, { repair: true }), '', `${item.op} ${item.kind}`);
    assert.notEqual(refusedWhy(line('+', 'item'), null, { repair: true, late: true }), '', 'a late line keeps the strict wall');
    assert.notEqual(refusedWhy(line('+', 'item', { heal: '5' }), null, { repair: true }), '', 'a heal label');
});

test('repair runs only on a miss, on the Quick role, and its lines land in <Changes-assist> and are applied as Assist lines', { skip }, async () => {
    const host = await repairHost();
    host.sdk.command?.('inventory.wallet.receive', {});
    const withBlock = await host.send('I look.', 'A quiet room.\n<Changes>\n</Changes>');
    await wait(30);
    assert.equal(host.calls.length, 0, 'a reply with a block (even an empty one) is never repaired');
    assert.deepEqual(noChanges(host), []);
    const miss = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(host.calls.length, 1);
    assert.equal(host.calls[0].options.profile, '', 'the Quick role (no profile named here)');
    assert.match(host.calls[0].prompt, /^A reply in an interactive story should have ended with a block of change lines/);
    assert.match(host.calls[0].prompt, /The story before this reply:\nWallet \(before this reply\)/);
    assert.deepEqual(assistSections(host.ctx.chat[miss.index].mes).now, ['+ coin 30 | from: Bob', '+ item Rope | qty: 1', '~ place Old Mill | kind: settlement']);
    const receipts = host.ctx.chat[miss.index].extra.storySuite.receipts;
    assert.deepEqual(receipts.filter(item => item.assist === 'now').map(item => item.type).sort(), ['capture.coin', 'capture.item', 'capture.place']);
    assert.equal(wallet(host), 30);
    assert.equal(ropes(host), 1);
    assert.equal(host.sdk.query('scene.place').name, 'Old Mill');
    assert.deepEqual(noChanges(host), [], 'repaired: no warning');
    assert.equal(withBlock.index < miss.index, true);
    host.close();
});

test('swipe, swipe back, Re-read, edited Re-read, reload and a middle delete replay the repaired lines with no second call', { skip }, async () => {
    const host = await repairHost();
    const first = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(host.calls.length, 1);
    const state = () => [wallet(host), ropes(host), host.sdk.query('scene.place')?.name];
    assert.deepEqual(state(), [30, 1, 'Old Mill']);
    const stored = assistSections(host.ctx.chat[first.index].mes).now;
    // Re-read: the same lines from what is stored.
    assert.equal((await host.sdk.reread(first.index)).ok, true);
    assert.deepEqual(state(), [30, 1, 'Old Mill']);
    // An edited Re-read, grown and then shrunk (the reply still has no block): the stored lines stay.
    const message = host.ctx.chat[first.index];
    for (const text of [`${message.mes}\n\nHe adds a long, rambling farewell about the weather.`, BLOCKLESS]) {
        const hidden = message.mes.slice(message.mes.indexOf('\n\n<!--'));
        message.mes = `${text.replace(/\n\n<!--[\s\S]*$/, '')}${hidden}`;
        message.swipes[message.swipe_id] = message.mes;
        assert.equal((await host.sdk.reread(first.index)).ok, true);
        assert.deepEqual(state(), [30, 1, 'Old Mill'], 'edited Re-read');
        assert.deepEqual(assistSections(message.mes).now, stored);
    }
    // A swipe with a block of its own, then back to the repaired swipe.
    await host.swipe('A new swipe.\n<Changes>\n+ present Dries\n</Changes>');
    await wait(30);
    assert.equal(wallet(host), 0, 'the other swipe has no coin');
    await host.st.swipeTo(first.index, 0);
    await host.turn.onChatChanged();
    assert.deepEqual(state(), [30, 1, 'Old Mill'], 'swipe back');
    // Reload (the chat opened again).
    await host.turn.onChatChanged();
    assert.deepEqual(state(), [30, 1, 'Old Mill'], 'reload');
    // A middle delete: a reply after it, then the first reply's neighbour goes; here the later reply is deleted and the first one still stands.
    const later = await host.send('Then?', 'Nothing more.\n<Changes>\n</Changes>');
    await host.st.deleteMessage(later.index);
    await host.turn.onChatChanged();
    assert.deepEqual(state(), [30, 1, 'Old Mill'], 'delete');
    assert.equal(host.calls.length, 1, 'never a second call');
    host.close();
});

test('the switch off makes no call and warns with a Problems row', { skip }, async () => {
    const off = await repairHost({ repair: false });
    const quiet = await off.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(off.calls.length, 0, 'switch off: no call');
    assert.equal(wallet(off), 0);
    const rows = noChanges(off);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].index, quiet.index);
    assert.match(rows[0].message, /^No change block came with this reply, so nothing in it was recorded\./);
    off.close();
});

test('a failed call is a warning too, and gives the reply no lines', { skip }, async () => {
    const host = await repairHost({ model: async () => { throw new Error('no connection'); } });
    const turn = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.deepEqual(assistSections(host.ctx.chat[turn.index].mes).now, []);
    const rows = noChanges(host);
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /the repair call failed/);
    host.close();
});

test('an empty answer is no lines, with a "found nothing" row; a coin line that cannot be paid is refused with its reason, undoable lines stay', { skip }, async () => {
    const empty = await repairHost({ answer: '<Changes></Changes>' });
    await empty.send('I look.', 'Nothing happens at all.');
    await wait(30);
    assert.equal(empty.calls.length, 1);
    assert.match(noChanges(empty)[0].message, /the repair found nothing to record/);
    empty.close();
    const broke = await repairHost({ answer: '<Changes>\n- coin 5 | to: Bob\n+ item Rope | qty: 1\n</Changes>' });
    await broke.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(ropes(broke), 1);
    assert.ok(broke.turn.problems().some(item => /was not used/.test(item.message) && /- coin 5/.test(item.message)));
    broke.close();
});

test('the repairer asks the Quick role, once per carrier, with a 20 s time-out that is a failure, a timed-out call is asked again, a second call for an answered swipe never', async () => {
    const calls = [];
    const log = createRunLog();
    const hang = createRepairer({ callModel: (prompt, options) => { calls.push(options); return new Promise(() => {}); }, settings: () => ({ [SETTING.repair]: true }), grammar: () => ['+ item Name'], capture: async () => null,
        chatId: () => 'c', log, warn: () => {}, timeoutMs: 5 });
    const reply = { index: 3, swipe: 0, type: 'normal', mes: 'He gives you a rope.', missing: true, sid: 'a' };
    const out = await hang.afterReply(reply);
    assert.equal(out.attempted, true);
    assert.equal(out.repair, 'failed');
    assert.equal(log.last('repair').outcome, 'timeout');
    assert.equal(calls[0].role, 'quick');
    assert.equal(calls[0].helper, 'repair');
    assert.equal((await hang.afterReply(reply)).attempted, true, 'a timed-out ask is asked again (Re-read)');
    assert.equal(calls.length, 2);
    const answers = createRepairer({ callModel: async () => '<Changes></Changes>', settings: () => ({ [SETTING.repair]: true }), grammar: () => ['+ item Name'], capture: async () => null, chatId: () => 'c', log, warn: () => {} });
    assert.equal((await answers.afterReply(reply)).attempted, true);
    assert.equal((await answers.afterReply(reply)).attempted, false, 'once per carrier and swipe once it answered');
    for (const skipped of [{ ...reply, sid: 'b', missing: false }, { ...reply, sid: 'c', type: 'continue' }, { ...reply, sid: 'd', type: 'quiet' }, { ...reply, sid: 'e', mes: '' }]) {
        assert.equal((await hang.afterReply(skipped)).attempted, false);
    }
    const off = createRepairer({ callModel: async () => { throw new Error('never'); }, settings: () => ({ [SETTING.repair]: false }), grammar: () => ['+ item Name'], capture: async () => null, chatId: () => 'c', log, warn: () => {} });
    assert.equal((await off.afterReply({ ...reply, sid: 'f' })).attempted, false);
});

test('Re-read of a reply that still has no block asks the repair once; the second Re-read replays it with no call', { skip }, async () => {
    const host = await repairHost({ repair: false });
    const turn = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(host.calls.length, 0);
    assert.equal(noChanges(host).length, 1, 'warned: the repair was off');
    const hostSettings = host.ctx.extensionSettings.storySuite.modules['story-block'];
    hostSettings[SETTING.repair] = true;
    assert.equal((await host.sdk.reread(turn.index)).ok, true);
    await wait(50);
    assert.equal(host.calls.length, 1, 'the Re-read asked once');
    assert.equal(assistSections(host.ctx.chat[turn.index].mes).now.length, 3);
    assert.equal(wallet(host), 30);
    assert.equal((await host.sdk.reread(turn.index)).ok, true);
    await wait(50);
    assert.equal(host.calls.length, 1, 'no second call');
    assert.equal(wallet(host), 30);
    host.close();
});

test('a block written as one line, empty, is a block: no repair call, no warning; a head-only Re-read asks the repair, an older reply never does', { skip }, async () => {
    const host = await repairHost({ repair: false });
    const one = await host.send('I look.', 'A quiet room.\n<Changes></Changes>');
    const two = await host.send('I wait.', 'The same room, later.\n<Changes>\n</Changes>');
    const miss = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(host.calls.length, 0);
    assert.deepEqual(noChanges(host).map(item => item.index), [miss.index], 'only the reply with no block is warned');
    assert.equal(host.ctx.chat[one.index].mes.includes('`'), false);
    host.ctx.extensionSettings.storySuite.modules['story-block'][SETTING.repair] = true;
    await host.send('Then.', 'A last quiet word.\n<Changes></Changes>');
    assert.equal((await host.sdk.reread(miss.index)).ok, true);
    await wait(50);
    assert.equal(host.calls.length, 0, 'not the head any more: a Re-read of an older reply makes no call');
    assert.equal(two.index < miss.index, true);
    host.close();
});

test('A repaired, B and C with blocks: delete B (middle), swipe C blockless then back, switch chats and back, rewind: one call for the swipe, the same state everywhere', { skip }, async () => {
    const host = await repairHost();
    const a = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    const b = await host.send('Lamp.', 'A lamp.\n<Changes>\n+ item Lamp\n</Changes>');
    const c = await host.send('Look.', 'Dust.\n<Changes>\n</Changes>');
    assert.equal(host.calls.length, 1);
    const state = () => [wallet(host), ropes(host), (host.sdk.query('inventory.items') ?? []).filter(item => item.name === 'Lamp').length, host.sdk.query('scene.place')?.name];
    assert.deepEqual(state(), [30, 1, 1, 'Old Mill']);
    // A blockless swipe of C: its own call (nothing to repair in it: empty answer), then back to C's first swipe through the swiped event only.
    const swipeCall = host.calls.length;
    host.calls.length = 0;
    await host.swipe('Only dust again, no block.');
    await wait(40);
    assert.equal(host.calls.length, 1, 'the new swipe is a miss: one call');
    await host.st.swipeTo(c.index, 0);
    await wait(40);
    assert.equal(host.calls.length, 1, 'swipe back: no further call');
    assert.deepEqual(state(), [30, 1, 1, 'Old Mill'], 'swipe back, no reload');
    const savedBeforeRewind = structuredClone(host.ctx.chat);
    // Rewind: back to before B's change (A's repaired coin and rope stay, the lamp goes).
    const rev = readRecord(host.ctx.chat[b.index]).receipts[0].rev;
    const back = await host.sdk.rewind({ index: b.index, beforeRev: rev });
    assert.equal(back.ok, true, JSON.stringify(back));
    await wait(30);
    assert.deepEqual(state(), [30, 1, 0, 'Old Mill'], 'rewind');
    assert.equal(host.calls.length, 1, 'rewind: no call');
    await host.st.loadChat(structuredClone(savedBeforeRewind), 'main');
    await wait(30);
    // Middle delete: B goes.
    await host.st.deleteMessage(b.index);
    await wait(30);
    assert.equal(host.calls.length, 1);
    assert.deepEqual([wallet(host), ropes(host), host.sdk.query('scene.place')?.name], [30, 1, 'Old Mill'], 'A still stands after B is deleted');
    // Chat change: another chat and back.
    const saved = structuredClone(host.ctx.chat);
    await host.st.loadChat([{ is_user: false, name: 'N', mes: 'Elsewhere.' }], 'other');
    await host.st.loadChat(saved, 'main');
    await wait(30);
    assert.deepEqual([wallet(host), ropes(host)], [30, 1], 'chat change and back');
    assert.equal(host.calls.length, 1, 'no new call');
    assert.equal(swipeCall, 1);
    host.close();
});
