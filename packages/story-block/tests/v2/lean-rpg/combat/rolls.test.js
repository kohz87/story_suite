// Combat Rules v1 rolls: player bonuses over a seeded stat x level grid, foe bonuses over every tier and level, the
// mastery term, and attack / defence / flee outcomes (ties, natural 1, natural 20 and the decisive margin).

import test from 'node:test';
import assert from 'node:assert/strict';
import { rng as seeded } from '../../../../src/v2/rng.js';
import { foeRoll, masteryTerm, playerRoll, rollOutcome } from '../../../../src/v2/lean-rpg/combat/rolls.js';
import { foeStats } from '../../../../src/v2/lean-rpg/combat/foes.js';
import { RANKS, TIERS } from '../../../../src/v2/lean-rpg/combat/numbers.js';
import { bonusesOf, foeOf, playerHit, foeHit, rollMastery } from '../v1/oracle.js';

const KINDS = ['physical', 'magic', 'evasion', 'tempo', 'order', 'flee'];
const STANCES = [null, 'evasion', 'movement', 'defence', 'support'];
const LEVELS = [1, 2, 7, 15, 30, 50, 75, 99];
const STATS = ['str', 'vit', 'agi', 'dex', 'int', 'wis'];
const random = seeded(0xC2_0001);
const pick = list => list[Math.floor(random() * list.length)];
const normalize = outcome => (String(outcome).startsWith('miss') ? 'miss' : outcome);

test('mastery is half rounded up on a roll and full on damage or healing', () => {
    for (let mastery = 0; mastery <= 12; mastery++) assert.equal(masteryTerm(mastery), rollMastery(mastery));
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(masteryTerm), [0, 1, 1, 2, 2, 3, 3, 4]);
    assert.equal(masteryTerm('x'), 0);
    assert.equal(masteryTerm(-5), 0);
});

test('each player roll matches the oracle over a seeded stat x level x stance grid', () => {
    for (const focus of STATS) {
        for (let value = 5; value <= 30; value++) {
            const stats = Object.fromEntries(STATS.map(key => [key, 5]));
            stats[focus] = value;
            for (const level of LEVELS) {
                const mastery = pick(RANKS).mastery, stance = pick(STANCES);
                const expected = bonusesOf(stats, level, mastery, stance);
                for (const kind of KINDS) {
                    assert.equal(playerRoll(kind, stats, level, { mastery, stance }), expected[kind],
                        `${kind}: ${focus} ${value}, L${level}, mastery ${mastery}, stance ${stance}`);
                }
            }
        }
    }
});

test('stats clamp to 1..30, level to 1..99, and missing stats read as the start value', () => {
    const base = { str: 5, vit: 5, agi: 5, dex: 5, int: 5, wis: 5 };
    assert.equal(playerRoll('physical', { dex: 99 }, 999), Math.floor(30 / 2) + Math.floor(99 / 4));
    assert.equal(playerRoll('magic', {}, 0), Math.floor(5 / 2));
    assert.equal(playerRoll('evasion', { agi: -9 }, 1), 0);
    assert.throws(() => playerRoll('luck', base, 1), /Unknown player roll/);
});

test('evasion and tempo add half mastery only while their stance is on', () => {
    const stats = { agi: 15 }, level = 15, mastery = 5, half = masteryTerm(mastery);
    assert.equal(playerRoll('evasion', stats, level, { mastery, stance: 'evasion' }), playerRoll('evasion', stats, level) + half);
    assert.equal(playerRoll('tempo', stats, level, { mastery, stance: 'movement' }), playerRoll('tempo', stats, level) + half);
    assert.equal(playerRoll('tempo', stats, level, { mastery, stance: 'evasion' }), playerRoll('tempo', stats, level));
    assert.equal(playerRoll('evasion', stats, level, { mastery, stance: 'movement' }), playerRoll('evasion', stats, level));
});

test('a foe has one roll bonus at every tier and level', () => {
    for (const tier of Object.keys(TIERS)) {
        for (let level = 1; level <= 99; level++) {
            const foe = foeStats({ level, tier });
            assert.equal(foeRoll(foe), foeOf(tier, level).roll, `${tier} L${level}`);
            assert.equal(foeRoll({ level, tier }), foeOf(tier, level).roll, `${tier} L${level} by level`);
            assert.equal(foeRoll({ level, tier }, 'order'), foeOf(tier, level).order, `${tier} L${level} order`);
        }
    }
    assert.equal(foeRoll({ level: 30, tier: 'elite' }), 17);
    assert.equal(foeRoll({ level: 30, tier: 'ELITE' }), 17);
    assert.equal(foeRoll(12), 12);
});

test('a player tie hits, natural 1 misses, and natural 20 or a lead of 8 is decisive', () => {
    assert.equal(rollOutcome(10, 5, 15), 'hit');
    assert.equal(rollOutcome(10, 4, 15), 'miss');
    assert.equal(rollOutcome(1, 40, 5), 'miss');
    assert.equal(rollOutcome(10, 13, 15), 'decisive');
    assert.equal(rollOutcome(20, 0, 12), 'decisive');
    assert.equal(rollOutcome(20, 0, 21), 'miss');
    assert.equal(rollOutcome(19, 0, 30), 'miss');
});

test('a foe tie is evaded, and a natural 20 or a lead of 8 is decisive', () => {
    assert.equal(rollOutcome(10, 5, 15, 'foe'), 'evaded');
    assert.equal(rollOutcome(10, 6, 15, 'foe'), 'hit');
    assert.equal(rollOutcome(10, 13, 15, 'foe'), 'decisive');
    assert.equal(rollOutcome(20, 0, 12, 'foe'), 'decisive');
    assert.equal(rollOutcome(20, 0, 30, 'foe'), 'evaded');
    assert.equal(rollOutcome(1, 6, 15, 'foe'), 'evaded');
});

test('a flee succeeds on a tie and fails below it', () => {
    assert.equal(rollOutcome(10, 5, 15, 'flee'), 'success');
    assert.equal(rollOutcome(10, 4, 15, 'flee'), 'fail');
    assert.equal(rollOutcome(1, 0, 30, 'flee'), 'fail');
});

test('the outcome rules match the oracle across every natural die and a seeded bonus / defence grid', () => {
    for (let die = 1; die <= 20; die++) {
        for (let i = 0; i < 24; i++) {
            const bonus = Math.floor(random() * 31), against = Math.floor(random() * 61);
            assert.equal(rollOutcome(die, bonus, against), normalize(playerHit(die, bonus, against)));
            assert.equal(rollOutcome(die, bonus, against, 'foe'), foeHit(die, bonus, against));
        }
    }
});
