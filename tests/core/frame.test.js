// Pack format 4, job F1: the chat frame is written once in the chat's own state, and a game swapped later does not move it. Swipes, a swipe back, a
// middle delete, a rewind, a reload and an edited Re-read (grown and shrunk) all leave the frame as it was, and replay equals live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../core/persist.js';
import { FROST, SUN, frameHost, frameOf, problems, said, swapGame, world } from './frame.helpers.js';

const plain = value => JSON.parse(JSON.stringify(value ?? null));
const monthsOf = frame => frame?.calendar?.months.map(month => month.name);
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    const result = await host.sdk.reread(index);
    assert.equal(result.ok, true, result.message);
};

test('the first reply writes the frame: the world and game (id, version, hash), the game\'s calendar and its currency', async t => {
    const host = await frameHost(t);
    assert.equal(frameOf(host), null, 'nothing before the first reply');
    await host.send('hi', said('R1.'));
    const frame = frameOf(host);
    assert.deepEqual([frame.set, frame.refresh, frame.world.pack, frame.world.version, frame.game.pack, frame.game.version], [true, false, 'w1', '1.0.0', 'g1', '1.0.0']);
    assert.match(frame.world.hash, /^[0-9a-f]{64}$/);
    assert.match(frame.game.hash, /^[0-9a-f]{64}$/);
    assert.deepEqual(monthsOf(frame), ['Frost', 'Bloom']);
    assert.equal(frame.currency.name, 'mark');
    assert.deepEqual(host.registry.validator('frame')(frame, host.head()), []);
    assert.deepEqual(plain(host.sdk.query('packs.frame')), frame, 'the query readers use');
    assert.deepEqual(problems(host), []);
    const packs = host.packs.packs.packs();
    assert.equal(packs[0], host.packs.packs.packs()[0], 'the checked pack objects are kept, so their hashes are made once');
    await host.send('more', said('R2.'));
    assert.equal(host.ctx.chat.flatMap(message => readRecord(message)?.receipts ?? []).filter(receipt => receipt.type === 'packs.frame').length, 1, 'written once');
});

test('a game swapped after the first reply moves neither the calendar nor the money of the chat (and the swap itself is live)', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    const before = plain(frameOf(host));
    await swapGame(host, 'g2', SUN, 'sun');
    assert.deepEqual(host.packs.packs.selected(), { world: 'w1', game: 'g2' });
    assert.deepEqual(host.packs.part.queries['packs.calendar']().months.map(month => month.name), ['Sun'], 'Settings read the new game live');
    await host.send('again', said('R2.'));
    assert.deepEqual(plain(frameOf(host)), before);
    assert.deepEqual(monthsOf(frameOf(host)), ['Frost', 'Bloom']);
    assert.equal(frameOf(host).currency.name, 'mark');
    host.store.rebuild();
    assert.deepEqual(plain(frameOf(host)), before, 'a reload reads the same frame');
});

test('swipe and swipe back, with a game swapped between, keep the frame', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    const before = plain(frameOf(host));
    await swapGame(host, 'g2', SUN, 'sun');
    await host.swipe(said('R1 again.'));
    assert.deepEqual(plain(frameOf(host)), before);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(plain(frameOf(host)), before);
    await host.regenerate(said('R1 once more.'));
    assert.deepEqual(plain(frameOf(host)), before);
    host.store.rebuild();
    assert.deepEqual(plain(frameOf(host)), before);
    assert.deepEqual(problems(host), []);
});

test('an edited Re-read, grown and then shrunk, keeps the frame with no Problems', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    await host.send('more', said('R2.'));
    const before = plain(frameOf(host));
    await swapGame(host, 'g2', SUN, 'sun');
    await reread(host, 2, `A longer first reply that goes on and on.\n\n<Changes>\n+ coin 10 | from: Bob\n+ coin 20 | from: Bob\n+ coin 30 | from: Bob\n</Changes>`);
    assert.deepEqual(plain(frameOf(host)), before);
    await reread(host, 2, 'Short.\n\n<Changes>\n+ coin 5 | from: Bob\n</Changes>');
    assert.deepEqual(plain(frameOf(host)), before);
    host.store.rebuild();
    assert.deepEqual(plain(frameOf(host)), before);
    assert.deepEqual(problems(host), []);
});

test('a middle delete of a reply keeps the frame; a reload and a second host reading the saved chat agree', async t => {
    const host = await frameHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await host.send('c', said('R3.'));
    const before = plain(frameOf(host));
    await host.st.deleteMessage(2);
    await host.st.deleteMessage(2);
    assert.deepEqual(plain(frameOf(host)), before);
    const saved = structuredClone(host.ctx.chat);
    await host.st.loadChat(structuredClone(saved));
    assert.deepEqual(plain(frameOf(host)), before);
    const other = await frameHost(t);
    await other.st.loadChat(saved);
    assert.deepEqual(plain(frameOf(other)), before, 'a second host replays the same frame');
    assert.deepEqual(problems(host), []);
});

test('a rewind to after the frame keeps it; a rewind to before it removes it, and the next reply writes one from the game then selected', async t => {
    const host = await frameHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    const before = plain(frameOf(host));
    const revOf = index => readRecord(host.ctx.chat[index])?.receipts?.at(-1)?.rev;
    const kept = await host.sdk.rewind({ index: 4, beforeRev: revOf(4) });
    assert.equal(kept.ok, true, JSON.stringify(kept));
    assert.deepEqual(plain(frameOf(host)), before, 'after the frame');
    const frameRev = readRecord(host.ctx.chat[0]).receipts.find(receipt => receipt.type === 'packs.frame').rev;
    const gone = await host.sdk.rewind({ index: 0, beforeRev: frameRev });
    assert.equal(gone.ok, true, gone.message);
    assert.equal(frameOf(host), null, 'before the frame');
    await swapGame(host, 'g2', SUN, 'sun');
    await host.send('c', said('R3.'));
    assert.deepEqual(monthsOf(frameOf(host)), ['Sun']);
    host.store.rebuild();
    assert.deepEqual(monthsOf(frameOf(host)), ['Sun']);
});

test('without the frame, the swap would move the chat: the calendar the chat reads is the frame, not the live game', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    await swapGame(host, 'g2', SUN, 'sun');
    const live = host.packs.part.queries['packs.calendar']().months.map(month => month.name);
    assert.notDeepEqual(live, monthsOf(frameOf(host)));
    assert.deepEqual(monthsOf(frameOf(host)), FROST.map(month => month.name));
});

test('a world with the built-in game: the frame says "built-in" and holds no calendar or currency', async t => {
    const host = await frameHost(t, { selected: false });
    assert.equal((await host.packs.packs.install(world())).ok, true);
    await host.send('hi', said('R1.'));
    const frame = frameOf(host);
    assert.deepEqual([frame.world.pack, frame.game, frame.calendar, frame.currency], ['w1', 'built-in', null, null]);
    assert.deepEqual(host.registry.validator('frame')(frame, host.head()), []);
    host.store.rebuild();
    assert.deepEqual(plain(frameOf(host)), plain(frame));
});
