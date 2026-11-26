// The world pack's opt-in to naming places by file id: `"placeIds": true` at the top of a format 4 world pack, only `true`, never
// filled in; `packs.content` kind placeIds lists the packs that say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';

const raw = (extra = {}, kind = 'world', id = 'ids') => ({ id, version: '1.0.0', format: 4, kind, requires: { suite: '^0.1' }, content: {}, ...extra });
const check = (...args) => validatePack(raw(...args));

test('placeIds: true is taken on a world pack and kept', () => {
    const result = check({ placeIds: true });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.pack.placeIds, true);
});

test('left out, nothing is filled in', () => {
    const result = check();
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal('placeIds' in result.pack, false);
});

test('any value but true is refused', () => {
    for (const value of [false, null, 0, 1, 'true', '', [], {}]) {
        const result = check({ placeIds: value });
        assert.equal(result.ok, false, JSON.stringify(value));
        assert.deepEqual(result.errors.map(error => [error.code, error.path]), [['BAD_FIELD', 'placeIds']], JSON.stringify(value));
    }
});

test('a game pack may not hold it, and it is no content key', () => {
    const game = check({ placeIds: true }, 'game');
    assert.equal(game.ok, false);
    assert.deepEqual(game.errors.map(error => [error.code, error.path]), [['UNKNOWN_FIELD', 'placeIds']]);
    assert.match(game.errors[0].message, /world pack/);
    const inside = check({ content: { placeIds: true } });
    assert.equal(inside.ok, false);
    assert.equal(inside.errors[0].path, 'content.placeIds');
});

test('packs.content kind placeIds lists the packs that opted in, and no others', () => {
    const packs = [check({ placeIds: true }).pack, check({}, 'world', 'plain').pack];
    assert.deepEqual([...contentOf(packs, 'placeIds')], ['ids']);
    assert.deepEqual([...contentOf(packs, 'placeIds', { pack: 'plain' })], []);
});

test('the shipped Ersveil world does not opt in', () => {
    const result = validatePack(readFileSync(new URL('../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal('placeIds' in result.pack, false);
});
