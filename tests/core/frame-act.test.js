// Pack format 4, job F1: "Use the current game in this chat" (a pending marker in the chat's own state, applied by the next reply), a chat change, the
// note that a pack changed since the chat began, hostile frames, and a chat with no format 4 world or game: no frame, nothing different.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../core/persist.js';
import { frameProblem, validateFrame } from '../../core/runtime/frame-parts/shape.js';
import { FROST, SUN, frameHost, frameOf, game, problems, said, swapGame, world } from './frame.helpers.js';

const plain = value => JSON.parse(JSON.stringify(value ?? null));
const monthsOf = frame => frame?.calendar?.months.map(month => month.name);
const receipts = host => host.ctx.chat.flatMap(message => readRecord(message)?.receipts ?? []).map(receipt => receipt.type);
const use = host => host.sdk.command('packs.frameUse', {});

test('the act marks the chat; the next reply writes the frame again from the game selected then, and the marker is gone', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    await swapGame(host, 'g2', SUN, 'sun');
    assert.deepEqual(monthsOf(frameOf(host)), ['Frost', 'Bloom'], 'a swap alone changes nothing');
    assert.equal((await use(host)).ok, true);
    assert.equal(frameOf(host).refresh, true);
    assert.deepEqual(monthsOf(frameOf(host)), ['Frost', 'Bloom'], 'until the next reply');
    await host.send('on', said('R2.'));
    assert.deepEqual([frameOf(host).refresh, frameOf(host).game.pack, monthsOf(frameOf(host)), frameOf(host).currency.name], [false, 'g2', ['Sun'], 'sun']);
    host.store.rebuild();
    assert.deepEqual([frameOf(host).refresh, frameOf(host).game.pack, monthsOf(frameOf(host))], [false, 'g2', ['Sun']]);
});

test('the reply that applied the act, swiped and swiped back with the game swapped again between, keeps the new frame', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    await swapGame(host, 'g2', SUN, 'sun');
    await use(host);
    await host.send('on', said('R2.'));
    const after = plain(frameOf(host));
    await swapGame(host, 'g3', [{ name: 'Moon', days: 28 }], 'moon');
    await host.swipe(said('R2 again.'));
    assert.deepEqual(plain(frameOf(host)), after);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(plain(frameOf(host)), after);
    await host.regenerate(said('R2 once more.'));
    assert.deepEqual(plain(frameOf(host)), after);
    host.store.rebuild();
    assert.deepEqual(plain(frameOf(host)), after);
    assert.deepEqual(problems(host), []);
});

test('the act is refused before the chat has a frame, and the story cannot make or mark one', async t => {
    const host = await frameHost(t);
    assert.equal((await use(host)).ok, false);
    await host.send('hi', said('R1.'));
    const payload = { world: null, game: 'built-in', calendar: null, currency: null };
    assert.equal((await host.sdk.command('packs.frame', payload)).ok, false, 'the reader cannot write the frame');
    assert.equal((await host.sdk.command('packs.frameTold', { key: 'x' })).ok, false);
    assert.equal((await host.bus.command('packs.frame', payload, { cause: 'system' })).ok, false, 'one frame, until the act asks again');
    assert.equal(frameOf(host).game.pack, 'g1');
});

test('a pending act stays with its chat: another chat writes its own frame, and the first still waits', async t => {
    const host = await frameHost(t);
    const blank = structuredClone(host.ctx.chat);
    await host.send('hi', said('R1.'));
    await use(host);
    const first = structuredClone(host.ctx.chat), id = host.ctx.chatId;
    await swapGame(host, 'g2', SUN, 'sun');
    await host.st.loadChat(blank, 'other');
    assert.equal(frameOf(host), null);
    await host.send('there', said('Elsewhere.'));
    assert.deepEqual([frameOf(host).refresh, frameOf(host).game.pack], [false, 'g2']);
    await host.st.loadChat(first, id);
    assert.deepEqual([frameOf(host).refresh, frameOf(host).game.pack, monthsOf(frameOf(host))], [true, 'g1', ['Frost', 'Bloom']]);
});

test('a pack that changed since the chat began is said once: new version, then a major version adds "start a new chat"', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    assert.deepEqual(problems(host), []);
    assert.equal((await host.packs.packs.install(world('1.1.0'))).ok, true, 'the same id replaces it');
    await host.send('a', said('R2.'));
    const notes = () => host.turn.problems().filter(entry => entry.code === 'PACK_CHANGED').map(entry => entry.message);
    assert.deepEqual(notes(), ['Ersveil changed since this chat began (1.0.0 → 1.1.0).']);
    await host.send('b', said('R3.'));
    assert.equal(notes().length, 1, 'once');
    assert.equal((await host.packs.packs.install(world('2.0.0'))).ok, true);
    await host.send('c', said('R4.'));
    assert.deepEqual(notes().slice(1), ['Ersveil changed since this chat began (1.0.0 → 2.0.0). Start a new chat to be safe.']);
    assert.equal(frameOf(host).world.version, '1.0.0', 'the frame itself is not rewritten');
    host.store.rebuild();
    await host.send('d', said('R5.'));
    assert.equal(notes().length, 2, 'a reload does not say it again');
});

test('hostile frames are refused: wrong shapes, extra keys, a bad hash, a long id, a calendar too large', () => {
    const good = { world: null, game: 'built-in', calendar: null, currency: null };
    assert.equal(frameProblem(good), '');
    const entry = { pack: 'w', version: '1', hash: '' };
    assert.equal(frameProblem({ ...good, world: entry, game: entry }), '');
    for (const bad of [null, [], 'x', { ...good, extra: 1 }, { ...good, game: null }, { ...good, game: 'other' }, { ...good, world: { ...entry, hash: 'XYZ' } },
        { ...good, world: { ...entry, pack: 'x'.repeat(201) } }, { ...good, world: { ...entry, extra: 1 } }, { ...good, calendar: [] }, { ...good, currency: 'mark' },
        { ...good, calendar: { months: 'x'.repeat(20001) } }, { ...good, calendar: { run() {} } }]) {
        assert.notEqual(frameProblem(bad), '', JSON.stringify(bad));
    }
    assert.deepEqual(validateFrame({ set: false, refresh: true, world: null, game: null, calendar: null, currency: null, told: '' }), []);
    assert.notEqual(validateFrame({ set: true, refresh: false, world: null, game: null, calendar: null, currency: null, told: '' }).length, 0);
    assert.notEqual(validateFrame({ set: 'yes', refresh: false, told: '' }).length, 0);
});

test('with no format 4 world or game selected there is no frame, no step and no domain: a chat of old packs or none is as it was', async t => {
    const host = await frameHost(t, { selected: false });
    await host.send('hi', said('R1.'));
    await host.send('more', said('R2.'));
    assert.equal(Object.hasOwn(host.head().domains, 'frame'), false);
    assert.equal(receipts(host).some(type => type.startsWith('packs.frame')), false);
    assert.equal(host.sdk.query('packs.frame'), null);
    await host.packs.packs.install(world());
    await host.packs.packs.install(game('g1', FROST, 'mark'));
    await host.send('now', said('R3.'));
    assert.equal(frameOf(host).game.pack, 'g1', 'a frame is written once something is selected');
});
