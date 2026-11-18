// ST-PAIR: the Studio's pairing (studio/pairing.js) — both packs are checked first; pairing runs only on passing packs; the Built-in game is the default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pairPacks } from '../../../studio/pairing.js';
import { checkPairing, validatePack } from '../../../packs/validate.js';

const base = { format: 4, version: '1.0.0', requires: { suite: '^0.1' } };
const months = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const world = (content = {}) => JSON.stringify({ ...base, id: 'w', kind: 'world', content: { start: { date: { year: 1, month: 5, day: 1 } }, ...content } });
const game = (content = {}) => JSON.stringify({ ...base, id: 'g', kind: 'game', content: { calendar: { months }, ...content } });

test('no game open: the world is paired with the Built-in game, and a month 5 start passes', () => {
    const answer = pairPacks(world(), null);
    assert.equal(answer.paired, true);
    assert.equal(answer.ok, true);
    assert.match(answer.message, /Built-in game/);
    assert.deepEqual(pairPacks(world(), '  ').errors, []);
});

test('the answer is the game\'s own checkPairing, with the pack to open', () => {
    const answer = pairPacks(world(), game());
    const direct = checkPairing(validatePack(world()).pack, validatePack(game()).pack);
    assert.deepEqual(answer.errors.map(({ pack, ...rest }) => rest), direct.errors);
    assert.deepEqual(answer.errors.map(entry => [entry.code, entry.pack]), [['PAIR_START_DATE', 'world']]);
    assert.equal(answer.ok, false);
    assert.match(answer.message, /1 to fix/);
});

test('a names culture with no region of the world points at the game pack', () => {
    const answer = pairPacks(world(), game({ names: { south: { regions: ['Nowhere'], given: ['a'] } } }));
    assert.deepEqual(answer.warnings.map(entry => [entry.code, entry.pack]), [['PAIR_CULTURE', 'game']]);
});

test('a pack with problems is not paired; the answer names which pack', () => {
    const badWorld = pairPacks('{"id": "w"}', game());
    assert.equal(badWorld.paired, false);
    assert.deepEqual(badWorld.blocked.map(item => item.pack), ['world']);
    assert.match(badWorld.message, /world pack has \d+ problem/);
    assert.deepEqual(badWorld.errors, []);
    const badGame = pairPacks(world(), 'not json');
    assert.deepEqual(badGame.blocked.map(item => item.pack), ['game']);
    const both = pairPacks('x', 'y');
    assert.deepEqual(both.blocked.map(item => item.pack), ['world', 'game']);
});

test('a game pack is not looked at when none is open, and a wrong kind is refused with the pack named', () => {
    assert.equal(pairPacks('{"id": "w"}', null).blocked.length, 1);
    const swapped = pairPacks(game(), world());
    assert.equal(swapped.paired, false);
    assert.deepEqual(swapped.blocked.map(item => item.pack), ['world', 'game']);
    assert.match(swapped.blocked[0].message, /not a world pack/);
});

test('repeatable: the same texts give the same answer', () => {
    assert.deepEqual(pairPacks(world(), game()), pairPacks(world(), game()));
});
