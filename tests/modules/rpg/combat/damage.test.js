// Combat Rules v1 damage: normal / skill / area / heal against the oracle, decisive ×1.5 rounded down, and VIT + stance + gear
// soak (capped at 50, at least 1 through, gear contributes soak only).

import test from 'node:test';
import assert from 'node:assert/strict';
import { rng as seeded } from '../../../../core/commands/rng.js';
import { damageOf, healOf, soakOf, takeHit } from '../../../../modules/rpg/combat/damage.js';
import { RANKS, V1 } from '../../../../modules/rpg/combat/numbers.js';
import { damages, decisiveDmg, soakOf as oracleSoak, takeSoak } from '../v1/oracle.js';

const STATS = ['str', 'vit', 'agi', 'dex', 'int', 'wis'];
const random = seeded(0xC2_0004);
const pick = list => list[Math.floor(random() * list.length)];

test('normal, skill, area and heal damage match the oracle over a seeded stat grid', () => {
    for (let run = 0; run < 1200; run++) {
        const stats = Object.fromEntries(STATS.map(key => [key, 5 + Math.floor(random() * 26)]));
        const mastery = pick(RANKS).mastery, oracle = damages(stats, mastery);
        assert.equal(damageOf('physical', stats), oracle.normalPhysical);
        assert.equal(damageOf('magic', stats), oracle.normalMagic);
        for (const stat of STATS) {
            assert.equal(damageOf('skill', stats, mastery, stat), oracle.skill(stat), `skill ${stat}`);
            assert.equal(damageOf('area', stats, mastery, stat), oracle.area(stat), `area ${stat}`);
        }
        assert.equal(damageOf('heal', stats, mastery), oracle.heal);
        assert.equal(healOf(stats, mastery), oracle.heal);
    }
});

test('a normal physical attack is STR for everyone: no weapon types, a named stat is ignored', () => {
    const stats = { str: 20, dex: 9, vit: 5, agi: 5, int: 5, wis: 5 };
    assert.equal(damageOf('physical', stats), 10);
    assert.equal(damageOf('physical', stats, 0, 'dex'), 10);
    assert.equal(damageOf({ kind: 'physical', stats, stat: 'dex' }), 10);
});

test('mastery adds in full to skills, areas and heals, and not to normal attacks', () => {
    const stats = { str: 10, dex: 10, vit: 5, agi: 5, int: 10, wis: 9 };
    assert.equal(damageOf('skill', stats, 5, 'str'), 10);
    assert.equal(damageOf('area', stats, 5, 'str'), 6);
    assert.equal(damageOf('heal', stats, 5), 8);
    assert.equal(damageOf('physical', stats, 5), 5);
});

test('decisive damage is 1.5 rounded down', () => {
    for (let damage = 1; damage <= 200; damage++) {
        assert.equal(takeHit(damage, 0, true), decisiveDmg(damage), `damage ${damage}`);
        assert.equal(takeHit(damage, 0, false), damage);
    }
    assert.equal(takeHit(3, 0, true), 4);
    assert.equal(takeHit(5, 0, true), 7);
});

test('soak is VIT + Defence mastery x 5 + gear, capped at 50', () => {
    for (let vit = 1; vit <= 30; vit++) {
        for (let mastery = 0; mastery <= 10; mastery++) {
            for (const gear of [0, 3, 12, 40]) {
                const expected = Math.min(V1.soakCap, vit + mastery * 5 + gear);
                assert.equal(soakOf(vit, mastery, gear), expected, `VIT ${vit}, mastery ${mastery}, gear ${gear}`);
            }
        }
    }
    assert.equal(soakOf(30, 5), 50);
    assert.equal(soakOf(30, 5, 20), 50);
    assert.equal(soakOf(10, 0, 12), 22);
    assert.equal(oracleSoak(30, 5), 50);
});

test('a hit after soak deals at least 1 and matches the oracle across seeded damage and soak', () => {
    for (let i = 0; i < 2000; i++) {
        const damage = 1 + Math.floor(random() * 100), soak = Math.floor(random() * 51);
        assert.equal(takeHit(damage, soak, false), takeSoak(damage, soak), `damage ${damage}, soak ${soak}`);
        assert.equal(takeHit(damage, soak, true), takeSoak(decisiveDmg(damage), soak), `decisive ${damage}, soak ${soak}`);
    }
    assert.equal(takeHit(1, 10), 1);
    assert.equal(takeHit(10, 50), 5);
    assert.equal(takeHit(9, 50), 4);
    assert.equal(takeHit(10, 90), 5);
});

test('damage input is whole and safe, and unknown kinds are refused', () => {
    const stats = { str: 10, vit: 5, agi: 5, dex: 5, int: 5, wis: 9 };
    assert.equal(damageOf('skill', stats, 2.9, 'str'), 7);
    assert.equal(healOf(9.9, 2.9), 5);
    assert.throws(() => damageOf('holy', stats), /Unknown damage kind/);
});
