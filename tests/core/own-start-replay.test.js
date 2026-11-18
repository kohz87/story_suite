// Pack format 4, job S1: the reader's own starting money and items and rank label, set before reply 1, replay the same way on a swipe and swipe back, an edited Re-read
// (grown and shrunk), a middle delete, a rewind, a reload and a second host; a change between loads is the reader's own act and moves the start of the chat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../core/persist.js';
import { frameHost, said, problems } from './frame.helpers.js';

const wallet = host => host.head().domains.inventory.wallets?.party?.coin ?? 0;
const rope = host => Object.values(host.head().domains.inventory.stacks ?? {}).filter(stack => /rope/i.test(host.head().domains.inventory.defs?.[stack.def]?.name ?? '')).reduce((sum, stack) => sum + (stack.qty ?? 0), 0);
const rank = host => host.sdk.query('packs.youRank')?.label ?? '';
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    const result = await host.sdk.reread(index);
    assert.equal(result.ok, true, result.message);
};

const greeting = () => [{ name: 'Ersveil', is_user: false, is_system: false, mes: 'The hall is quiet.', send_date: 'November 18, 2026 3:00pm', extra: {} }];

// A host over a chat that starts with the character's greeting (the first carrier: the chat's state is started, with the start applied, at the first reply).
async function ownHost(t, { set = true, money = '7', open = true } = {}) {
    const host = await frameHost(t);
    const packs = host.packs.packs;
    if (set) { await packs.setOwn('money', money); await packs.setOwn('items', 'Rope x2'); await packs.setOwn('rankLabel', 'Standing'); }
    if (open) await host.st.loadChat(greeting());
    return host;
}

test('the first reply starts the chat with the reader\'s money, items and rank label', async t => {
    const host = await ownHost(t);
    await host.send('hi', said('R1.', '+ coin 0 | from: Bob'));
    assert.deepEqual([wallet(host), rope(host), rank(host)], [7, 2, 'Standing']);
});

test('reply 1, a swipe and swipe back, a regenerate and a reload keep the start', async t => {
    const host = await ownHost(t);
    await host.send('hi', said('R1.'));
    assert.equal(wallet(host), 12);
    await host.swipe(said('R1 again.', '+ coin 3 | from: Bob'));
    assert.equal(wallet(host), 10);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(wallet(host), 12);
    await host.regenerate(said('R1 once more.'));
    assert.equal(wallet(host), 12);
    const live = [wallet(host), rope(host), rank(host)];
    host.store.rebuild();
    assert.deepEqual([wallet(host), rope(host), rank(host)], live);
    assert.deepEqual(problems(host), []);
});

test('an edited Re-read of reply 1, grown and then shrunk, keeps the start and the replies\' own changes', async t => {
    const host = await ownHost(t);
    await host.send('hi', said('R1.'));
    await host.send('more', said('R2.'));
    assert.equal(wallet(host), 17);
    await reread(host, 2, 'A longer first reply.\n\n<Changes>\n+ coin 10 | from: Bob\n+ coin 20 | from: Bob\n</Changes>');
    assert.equal(wallet(host), 7 + 30 + 5);
    await reread(host, 2, 'Short.\n\n<Changes>\n+ coin 1 | from: Bob\n</Changes>');
    assert.equal(wallet(host), 7 + 1 + 5);
    host.store.rebuild();
    assert.equal(wallet(host), 13);
    assert.deepEqual([rope(host), rank(host)], [2, 'Standing']);
    assert.deepEqual(problems(host), []);
});

test('a middle delete, and a second host reading the saved chat, keep the start', async t => {
    const host = await ownHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await host.send('c', said('R3.'));
    await host.st.deleteMessage(2);
    await host.st.deleteMessage(2);
    assert.equal(wallet(host), 7 + 5 + 5, 'the start and the two replies left');
    const saved = structuredClone(host.ctx.chat);
    const other = await ownHost(t, { open: false });
    await other.st.loadChat(saved);
    assert.deepEqual([wallet(other), rope(other), rank(other)], [wallet(host), rope(host), rank(host)]);
    assert.deepEqual(problems(host), []);
});

test('a rewind of a reply keeps the start', async t => {
    const host = await ownHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    const rev = index => readRecord(host.ctx.chat[index])?.receipts?.at(-1)?.rev;
    const done = await host.sdk.rewind({ index: 4, beforeRev: rev(4) });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(wallet(host), 7 + 5);
    assert.deepEqual([rope(host), rank(host)], [2, 'Standing']);
    host.store.rebuild();
    assert.equal(wallet(host), 12);
});

test('a change of the reader\'s money after the chat began does not move that chat (its start is kept in its first record); a new chat takes the new value', async t => {
    const host = await ownHost(t);
    await host.send('hi', said('R1.'));
    assert.equal(wallet(host), 12);
    await host.packs.packs.setOwn('money', '20');
    host.store.rebuild();
    assert.equal(wallet(host), 12, 'the chat keeps what it started with');
    const saved = structuredClone(host.ctx.chat);
    const other = await ownHost(t, { money: '20', open: false });
    await other.st.loadChat(saved);
    assert.equal(wallet(other), 12, 'a second host reading the saved chat agrees');
    const fresh = await ownHost(t, { money: '20' });
    await fresh.send('hi', said('R1.', '+ coin 0 | from: Bob'));
    assert.equal(wallet(fresh), 20, 'a new chat starts with the new value');
});

test('without any of the rows the start is the game\'s, as before', async t => {
    const host = await ownHost(t, { set: false });
    await host.send('hi', said('R1.', '+ coin 0 | from: Bob'));
    assert.deepEqual([wallet(host), rope(host), rank(host)], [0, 0, '']);
});
