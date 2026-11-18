// SOAK2UI 6: a cast of 3, 6 or 9 with equal warmth is spread around the centre, not drawn on one spot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placePeople } from '../../../../ui/tabs/people/map.js';

test('equal-warmth casts of 2, 3, 4, 6 and 9 each get their own place', () => {
  for (const n of [2, 3, 4, 6, 9]) {
    const people = Array.from({ length: n }, (_, i) => ({ personId: `p${i}`, name: `P${i}`, meters: { trust: 1, affection: 1 } }));
    const spots = Object.values(placePeople(people, 'warmth')).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
    assert.equal(new Set(spots).size, n, `${n} people, ${n} places`);
  }
});
