// The v1 dice rule, pinned (combat/dice.js): the kind keeps no seed; it takes the interaction port's dice source, and step i of a segment is exchange i of it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SLOT, fightDice } from '../../../../src/v2/lean-rpg/combat/dice.js';
import { playBoard } from '../../../../src/v2/lean-rpg/combat/play.js';
import { dice } from '../../../../src/v2/interaction/dice.js';
import { seeded } from './dice.helper.js';
import { withSkills } from './derived-skills.helper.js';

const KINDS = ['act', 'foe', 'check', 'init', 'open', 'flee'];

test('a fight die is the port die of step exchange - offset, lane 0, position slot * 6 + the kind, at any segment offset', () => {
    for (const seed of [0, 7, 123456789, 0xFFFFFFFF]) for (const offset of [0, 1, 5, 40]) for (const exchange of [offset, offset + 1, offset + 17]) {
        KINDS.forEach((kind, at) => { for (const slot of [0, 50, 154, 1040, 1000050]) {
            const mine = Array.from({ length: 4 }, () => fightDice(dice(seed, offset), exchange, offset)(kind, slot)());
            const port = Array.from({ length: 4 }, () => dice(seed, offset)(exchange - offset)(0, slot * 6 + at)());
            assert.deepEqual(mine, port, `${seed}/${offset}/${exchange}/${kind}/${slot}`);
        } });
    }
});

test('a fight split at a non-zero offset k draws the dice of the same fight played whole: dice(seed, k) at step N - k is dice(seed, 0) at step N', () => {
    for (const seed of [3, 99, 4000000000]) for (const k of [1, 4, 30]) for (const exchange of [k + 1, k + 2, k + 9]) {
        KINDS.forEach(kind => { for (const slot of [0, 50, 1040]) {
            const whole = Array.from({ length: 3 }, () => fightDice(dice(seed, 0), exchange, 0)(kind, slot)());
            const part = Array.from({ length: 3 }, () => fightDice(dice(seed, k), exchange, k)(kind, slot)());
            assert.deepEqual(part, whole, `${seed}/${k}/${exchange}/${kind}/${slot}`);
        } });
    }
});

test('a played fight keeps no seed of its own: only the dice source it is handed decides its dice', () => {
    const ace = withSkills({ id: 'Ace', label: 'Ace', build: 'Warrior', level: 12, mastery: 3, stats: { str: 20, vit: 20, agi: 8, dex: 8, int: 8, wis: 8, cha: 5 } });
    const foes = [{ id: 'f', label: 'Wolf', tier: 'standard', level: 6, hp: 500, maxHp: 500, damage: 3, roll: 8 }];
    const first = playBoard({ party: [ace], foes }, seeded({ seed: 5, maxExchanges: 3 }), [{}, {}, {}]);
    const same = playBoard({ party: [ace], foes }, { dice: dice(5, 0), maxExchanges: 3 }, [{}, {}, {}]);
    assert.deepEqual(same, first, 'the same source, the same fight');
    assert.notDeepEqual(playBoard({ party: [ace], foes }, { dice: dice(6, 0), maxExchanges: 3 }, [{}, {}, {}]).lines, first.lines);
    assert.ok(!('seed' in first), 'the record has no seed');
    assert.throws(() => playBoard({ party: [ace], foes }, { seed: 5 }, [{}]), /dice source/, 'a bare seed is not a source');
});

test('the dice have no other source: an unknown kind, a bad slot, a missing source or an exchange before the offset are refused', () => {
    assert.throws(() => fightDice(dice(1), 1)('luck', 0), /Unknown dice kind/);
    assert.throws(() => fightDice(dice(1), 1)('act', -1), /slot/);
    assert.throws(() => fightDice(dice(1), 1)('act', MAX_SLOT + 1), /slot/);
    assert.throws(() => fightDice(null, 1), /dice source/);
    assert.throws(() => fightDice(dice(1, 5), 4, 5), /before the segment offset/);
    const first = fightDice(dice(9), 2)('act', 40)();
    fightDice(dice(9), 2)('foe', 40)();
    assert.equal(fightDice(dice(9), 2)('act', 40)(), first, 'asking again gives the same die');
    assert.ok(MAX_SLOT * 6 + 5 < 2 ** 31, 'every position stays a small whole number (the port multiplies it by an odd constant mod 2^32: one position, one stream)');
});
