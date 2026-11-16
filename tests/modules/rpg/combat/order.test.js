// Combat Rules v1 initiative: both sides ordered by total then AGI, with a tie between the sides going to the party.

import test from 'node:test';
import assert from 'node:assert/strict';
import { rng as seeded } from '../../../../../../core/commands/rng.js';
import { initiative } from '../../../../src/v2/lean-rpg/combat/order.js';

const random = seeded(0xC2_0003);
const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

function oracle(party, foes) {
    const ours = [...party].sort((a, b) => b.total - a.total || b.agi - a.agi);
    const theirs = [...foes].sort((a, b) => b.total - a.total);
    const ourBest = party.length ? Math.max(...party.map(entry => entry.total)) : -Infinity;
    const theirBest = foes.length ? Math.max(...foes.map(entry => entry.total)) : -Infinity;
    return {
        party: ours.map(entry => entry.id),
        foes: theirs.map(entry => entry.id),
        first: party.length > 0 && ourBest >= theirBest ? 'party' : 'foes',
    };
}

test('party and foe initiative match the oracle over seeded totals and AGI', () => {
    for (let run = 0; run < 500; run++) {
        const party = Array.from({ length: between(1, 4) }, (_, i) => ({ id: `p${i}`, total: between(1, 30), agi: between(5, 30) }));
        const foes = Array.from({ length: between(0, 6) }, (_, i) => ({ id: `f${i}`, total: between(1, 30) }));
        assert.deepEqual(initiative(party, foes), oracle(party, foes), `run ${run}`);
    }
});

test('a cross-side tie gives the party first', () => {
    const party = [{ id: 'hero', total: 12, agi: 10 }];
    const foes = [{ id: 'foe', total: 12 }];
    assert.deepEqual(initiative(party, foes), { party: ['hero'], foes: ['foe'], first: 'party' });
});

test('a party tie goes to the higher AGI, then to the given order', () => {
    const party = [
        { id: 'slow', total: 12, agi: 7 },
        { id: 'first', total: 12, agi: 11 },
        { id: 'second', total: 12, agi: 11 },
    ];
    assert.deepEqual(initiative(party, []).party, ['first', 'second', 'slow']);
});

test('foes act first when their best total is higher, and side lists keep every member', () => {
    const party = [{ id: 'a', total: 5, agi: 9 }, { id: 'b', total: 9, agi: 5 }];
    const foes = [{ id: 'x', total: 10 }, { id: 'y', total: 4 }];
    assert.deepEqual(initiative(party, foes), { party: ['b', 'a'], foes: ['x', 'y'], first: 'foes' });
});

test('an empty side does not break initiative', () => {
    assert.deepEqual(initiative([{ id: 'a', total: 1, agi: 5 }], []), { party: ['a'], foes: [], first: 'party' });
    assert.deepEqual(initiative([], [{ id: 'f', total: 1 }]), { party: [], foes: ['f'], first: 'foes' });
    assert.deepEqual(initiative(), { party: [], foes: [], first: 'party' });
});
