// QA: the told-again canonicaliser (helpers/retell.js) keeps two keys that differ only by an ID apart, and the seed list reader
// (helpers/seed-list.js) refuses a malformed list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canon } from './helpers/retell.js';
import { seedList } from './helpers/seed-list.js';

test('canon keeps both values of two keys that differ only by an ID, and a malformed seed list throws', () => {
    const map = { 'loot:sw_aaaaaaaa11': 1, 'loot:sw_bbbbbbbb22': 2, other: 3 };
    const out = canon(map);
    assert.equal(JSON.stringify(out).includes('1') && JSON.stringify(out).includes('2'), true, 'no value is lost');
    assert.deepEqual(canon({ 'loot:sw_aaaaaaaa11': 2, 'loot:sw_bbbbbbbb22': 1, other: 3 }), out, 'the order of the colliding entries does not matter');
    assert.deepEqual(seedList('1-3,7'), [1, 2, 3, 7]);
    assert.throws(() => seedList('7-'), /QA_REREAD_SEEDS/);
    assert.throws(() => seedList('5-2'), /backwards/);
});
