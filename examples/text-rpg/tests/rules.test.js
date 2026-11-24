import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, difficultyIndex, isDifficultyWord } from '../src/rules/difficulty.js';
import { floorIndex, raiseToFloor } from '../src/rules/floor.js';
import { readEdge } from '../src/rules/edge.js';
import { statMod, rollBonus, verdict } from '../src/rules/roll.js';
import { HARM_STAGES, poolMax, harmFor, dropStages } from '../src/rules/harm.js';
import { practiceGain, levelFor } from '../src/rules/growth.js';
import { gainsAt } from '../src/rules/level-gains.js';
import { scaleXp, xpOfLevel } from '../src/rules/levels.js';
import { INJURY_DAYS, healDays, gearCap, effectiveStat } from '../src/rules/healing.js';

function stageOf(hp, max) {
    if (hp <= 0) return 'down';
    if (hp >= max) return 'unhurt';
    if (hp * 5 >= 4 * max) return 'scratched';
    if (hp * 20 >= 11 * max) return 'hurt';
    if (hp * 10 >= 3 * max) return 'wounded';
    return 'badly wounded';
}

test('difficulty words are fixed, found without case, and normal is ordinary', () => {
    assert.deepEqual(DIFFICULTIES, [
        { word: 'trivial', dc: 5 },
        { word: 'easy', dc: 10 },
        { word: 'ordinary', dc: 15 },
        { word: 'hard', dc: 20 },
        { word: 'very hard', dc: 25 },
        { word: 'near impossible', dc: 30 },
    ]);
    assert.equal(Object.isFrozen(DIFFICULTIES), true);
    assert.equal(DIFFICULTIES.every(item => Object.isFrozen(item)), true);
    assert.equal(difficultyIndex('trivial'), 0);
    assert.equal(difficultyIndex('easy'), 1);
    assert.equal(difficultyIndex('HARD'), 3);
    assert.equal(difficultyIndex('  Very Hard '), 4);
    assert.equal(difficultyIndex('near impossible'), 5);
    assert.equal(difficultyIndex('normal'), 2, 'the old word is an alias');
    assert.equal(difficultyIndex('unknown'), 2);
    assert.equal(difficultyIndex(null), 2);
    assert.deepEqual(['normal', 'Ordinary', 'trivial', 'hard', 'soon'].map(isDifficultyWord), [true, true, true, true, false]);
});

test('the floor follows crowds, fatigue and conditions: ordinary with the first, a step more for each further one', () => {
    assert.equal(floorIndex(), 0);
    assert.equal(floorIndex(null), 0);
    assert.equal(floorIndex({ conditions: 1 }), 2);
    assert.equal(floorIndex({ conditions: 2 }), 3);
    assert.equal(floorIndex({ count: 6 }), 3);
    assert.deepEqual([2, 3, 4, 5, 8, 9, 16, 17].map(count => floorIndex({ count })), [0, 2, 2, 3, 3, 4, 4, 5]);
    assert.equal(floorIndex({ drained: true, physical: true }), 2);
    assert.equal(floorIndex({ drained: true, physical: false }), 0);
    assert.equal(floorIndex({ count: 100, conditions: 4, drained: true, physical: true }), 5);
    assert.equal(floorIndex({ count: 'six', conditions: 'two' }), 0);
    assert.equal(floorIndex({ threat: 5 }), 0, 'a threat starts the difficulty; it is no floor');
});

test('a floor raises an index only when it is higher', () => {
    assert.deepEqual(raiseToFloor(1, 3), { index: 3, raised: true });
    assert.deepEqual(raiseToFloor(3, 3), { index: 3, raised: false });
    assert.deepEqual(raiseToFloor(5, 1), { index: 5, raised: false });
    assert.deepEqual(raiseToFloor(0, 0), { index: 0, raised: false });
    assert.deepEqual(raiseToFloor(null, null), { index: 2, raised: false });
    assert.deepEqual(raiseToFloor(9, 8), { index: 5, raised: false });
});

test('an edge moves the difficulty at most two steps, needs a reason, and no reason is ignored', () => {
    assert.equal(readEdge(''), null);
    assert.equal(readEdge(undefined), null);
    assert.deepEqual(readEdge('+1 (the guard sleeps)'), { steps: 1, why: 'the guard sleeps', ignored: false });
    assert.deepEqual(readEdge('-2 (rain on the stones)'), { steps: -2, why: 'rain on the stones', ignored: false });
    assert.deepEqual(readEdge('−1 (a wounded leg)'), { steps: -1, why: 'a wounded leg', ignored: false });
    assert.deepEqual(readEdge('+4 (a trap sprung)'), { steps: 2, why: 'a trap sprung', ignored: false }, 'at most two steps');
    assert.deepEqual(readEdge('-9 (a trap sprung)'), { steps: -2, why: 'a trap sprung', ignored: false });
    assert.deepEqual(readEdge('+1 high ground'), { steps: 1, why: 'high ground', ignored: false }, 'a reason without brackets counts');
    assert.deepEqual(readEdge('2 (surprise)'), { steps: 2, why: 'surprise', ignored: false }, 'no sign is a plus');
    for (const bad of ['+1', '+1 ()', '+1 (  )', '-2', 'lots', '(why)']) assert.deepEqual(readEdge(bad), { steps: 0, why: '', ignored: true }, bad);
});

test('a roll is the skill rank × 2: Novice 0 … Legend 12, a skill not on the sheet -3, a stat +0, -2 an injury; stats, gear and level are not in it', () => {
    assert.equal(statMod(8), -1);
    assert.equal(statMod(10), 0);
    assert.equal(statMod(20), 5);
    assert.equal(statMod(undefined), 0);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(rank => rollBonus({ rank })), [0, 2, 4, 6, 8, 10, 12]);
    assert.equal(rollBonus({ unlearned: true }), -3);
    assert.equal(rollBonus({}), 0, 'a plain stat try');
    assert.equal(rollBonus({ rank: 3, hampered: true }), 4);
    assert.equal(rollBonus({ rank: 3, hampered: 2 }), 2);
    assert.equal(rollBonus({ unlearned: true, hampered: 1 }), -5);
    assert.equal(rollBonus({ stat: 30, dex: 30, level: 99, rank: 1 }), 2, 'stats and level add nothing');
    assert.equal(rollBonus({ rank: 99 }), 12);
    assert.equal(rollBonus({ rank: -4 }), 0);
    assert.equal(rollBonus(), 0);
    assert.equal(rollBonus(null), 0);
});

test('verdict bands come from the margin alone; a natural 20 or 1 changes only the quality', () => {
    assert.deepEqual(verdict({ die: 12, bonus: 1, dc: 12 }), { band: 'success', total: 13, margin: 1, quality: null });
    assert.deepEqual(verdict({ die: 10, bonus: 0, dc: 12 }), { band: 'cost', total: 10, margin: -2, quality: null });
    assert.deepEqual(verdict({ die: 1, bonus: 30, dc: 8 }), { band: 'success', total: 31, margin: 23, quality: 'clumsy' }, 'a natural 1 that succeeds still succeeds');
    assert.deepEqual(verdict({ die: 20, bonus: -30, dc: 40 }), { band: 'bad', total: -10, margin: -50, quality: 'well done' }, 'a natural 20 that misses is still a miss');
    assert.deepEqual(verdict({ die: 20, bonus: 0, dc: 15 }), { band: 'success', total: 20, margin: 5, quality: 'well done' });
    assert.deepEqual(verdict({ die: 1, bonus: 0, dc: 15 }), { band: 'bad', total: 1, margin: -14, quality: 'clumsy' });
    assert.equal(verdict({ die: 12, bonus: 0, dc: 12 }).band, 'success');
    assert.equal(verdict({ die: 11, bonus: 0, dc: 12 }).band, 'cost');
    assert.equal(verdict({ die: 10, bonus: 0, dc: 12 }).band, 'cost');
    assert.equal(verdict({ die: 9, bonus: 0, dc: 12 }).band, 'failure');
    assert.equal(verdict({ die: 3, bonus: 0, dc: 12 }).band, 'failure');
    assert.equal(verdict({ die: 2, bonus: 0, dc: 12 }).band, 'bad');
    assert.deepEqual(verdict({ die: 12 }), { band: 'failure', total: 12, margin: -3, quality: null }, 'no number is ordinary (15)');
    assert.equal(verdict({ die: 0, bonus: 5, dc: 8 }), null);
    assert.equal(verdict({ die: 21, bonus: 5, dc: 8 }), null);
    assert.equal(verdict({ die: 12.5, bonus: 5, dc: 8 }), null);
    assert.equal(verdict({ bonus: 5, dc: 8 }), null);
    assert.equal(verdict(null), null);
});

test('harm bands and pool sizes are fixed', () => {
    assert.deepEqual(HARM_STAGES, { great: 0, success: 0, cost: 1, failure: 1, bad: 2 });
    assert.equal(Object.isFrozen(HARM_STAGES), true);
    assert.equal(poolMax('hp', { str: 10, vit: 8 }), 0, 'health is the five wound stages, not a pool');
    assert.equal(poolMax('luck', { str: 20, vit: 20 }), 0);
});

test('Mana and Stamina follow the RPG: 8 + level÷4 + (two stats)÷4, stats 1..30, level 1..99', () => {
    const table = [
        ['mp', { int: 5, wis: 5 }, 1, 10], ['mp', { int: 12, wis: 9 }, 1, 13], ['mp', { int: 6, wis: 6 }, 1, 11], ['mp', { int: 12, wis: 12 }, 4, 15],
        ['sp', { agi: 7, dex: 6 }, 3, 11], ['sp', { agi: 7, dex: 6 }, 4, 12], ['sp', { agi: 30, dex: 30 }, 99, 47], ['SP', { AGI: 99, DEX: 0 }, 1, 15],
        ['mp', { int: 1, wis: 1 }, 1, 8], ['mp', null, 1, 10], ['sp', { agi: 5, dex: 5 }, 0, 10], ['sp', { agi: 5, dex: 5 }, 500, 34],
    ];
    for (const [kind, stats, level, size] of table) assert.equal(poolMax(kind, stats, level), size, `${kind} ${JSON.stringify(stats)} Lv ${level}`);
    assert.equal(poolMax('mp', { int: 5, wis: 5 }), 10, 'no level is level 1');
});

test('harm depends on the band and whether the roll was in danger', () => {
    assert.equal(harmFor('great', true), 0);
    assert.equal(harmFor('success', false), 0);
    assert.equal(harmFor('cost', true), 1);
    assert.equal(harmFor('cost', false), 0);
    assert.equal(harmFor('failure', true), 1);
    assert.equal(harmFor('failure', false), 0);
    assert.equal(harmFor('failure'), 0);
    assert.equal(harmFor('bad', true), 2);
    assert.equal(harmFor('bad', false), 2);
    assert.equal(harmFor('unknown', true), 0);
    assert.equal(harmFor(null, true), 0);
});

test('dropping stages lands at each reached stage top and stops at badly wounded', () => {
    assert.equal(dropStages(20, 20, 1), 19);
    assert.equal(dropStages(16, 20, 1), 15);
    assert.equal(dropStages(11, 20, 1), 10);
    assert.equal(dropStages(6, 20, 1), 5);
    assert.equal(dropStages(20, 20, 2), 15);
    assert.equal(dropStages(20, 20, 3), 10);
    assert.equal(dropStages(20, 20, 4), 5);
    assert.equal(dropStages(20, 20, 99), 5);
    assert.equal(dropStages(2, 20, 1), 2);
    assert.equal(dropStages(20, 20, 0), 20);
    assert.equal(dropStages(20, 20, -1), 20);
    assert.equal(dropStages(8, 10, 0.5), 8);
    assert.equal(dropStages(20, 20, 'many'), 20);
    assert.equal(dropStages(20, 0, 1), 0);
    assert.equal(stageOf(dropStages(20, 20, 1), 20), 'scratched');
    assert.equal(stageOf(dropStages(20, 20, 2), 20), 'hurt');
    assert.equal(stageOf(dropStages(20, 20, 3), 20), 'wounded');
    assert.equal(stageOf(dropStages(20, 20, 4), 20), 'badly wounded');
    const reachedStages = ['scratched', 'hurt', 'wounded', 'badly wounded'];
    for (const max of [10, 20, 30, 45]) {
        for (let stages = 1; stages <= 4; stages += 1) {
            assert.equal(stageOf(dropStages(max, max, stages), max), reachedStages[stages - 1]);
        }
    }
});

test('practice follows difficulty and roll band: trivial teaches 1 (a plain use), a failure 3, a success or a cost 5, a success at hard or harder 10', () => {
    assert.equal(practiceGain('success', 0), 1);
    assert.equal(practiceGain('failure', 0), 1);
    assert.equal(practiceGain('success', 1), 5);
    assert.equal(practiceGain('success', 2), 5);
    assert.equal(practiceGain('success', 3), 10);
    assert.equal(practiceGain('success', 5), 10);
    assert.equal(practiceGain('great', 4), 10);
    assert.equal(practiceGain('great', 1), 5);
    assert.equal(practiceGain('cost', 1), 5);
    assert.equal(practiceGain('cost', 3), 5, 'a success at a cost is 5 at any difficulty');
    assert.equal(practiceGain('failure', 5), 3);
    assert.equal(practiceGain('bad', 3), 3);
    assert.equal(practiceGain('bad', 1), 3);
    assert.equal(practiceGain('unknown', 3), 0);
    assert.equal(practiceGain(null, 3), 0);
});

test('levels are 100 xp each as the RPG\'s, to 99, the xp held to 9999', () => {
    assert.deepEqual(levelFor(0), { level: 1, next: 100 });
    assert.deepEqual(levelFor(99), { level: 1, next: 100 });
    assert.deepEqual(levelFor(100), { level: 2, next: 200 });
    assert.deepEqual(levelFor(199), { level: 2, next: 200 });
    assert.deepEqual(levelFor(200), { level: 3, next: 300 });
    assert.deepEqual(levelFor(9799), { level: 98, next: 9800 });
    assert.deepEqual(levelFor(9800), { level: 99, next: null });
    assert.deepEqual(levelFor(Number.MAX_SAFE_INTEGER), { level: 99, next: null });
    assert.deepEqual(levelFor(-100), { level: 1, next: 100 });
    assert.deepEqual(levelFor('lots'), { level: 1, next: 100 });
    assert.deepEqual([xpOfLevel(1), xpOfLevel(2), xpOfLevel(99), xpOfLevel(500), xpOfLevel('x')], [0, 100, 9800, 9800, 0]);
});

test('level gains count a point a level and a skill slot every tenth level crossed', () => {
    assert.deepEqual(gainsAt(1, 1), { points: 0, slots: 0 });
    assert.deepEqual(gainsAt(1, 2), { points: 1, slots: 0 });
    assert.deepEqual(gainsAt(1, 10), { points: 9, slots: 1 });
    assert.deepEqual(gainsAt(2, 21), { points: 19, slots: 2 });
    assert.deepEqual(gainsAt(10, 19), { points: 9, slots: 0 });
    assert.deepEqual(gainsAt(6, 3), { points: 0, slots: 0 });
    assert.deepEqual(gainsAt(0, 10), { points: 9, slots: 1 });
    assert.deepEqual(gainsAt('one', 'three'), { points: 0, slots: 0 });
});

test('the XP rate scales a gain down to the step, at least 1 for a gain of 1 or more, and an odd rate is 100', () => {
    assert.deepEqual([50, 100, 150, 300].map(rate => scaleXp(20, rate)), [10, 20, 30, 60]);
    assert.deepEqual([scaleXp(1, 50), scaleXp(5, 50), scaleXp(0, 300), scaleXp(20, 60), scaleXp(20, undefined), scaleXp('x', 200)], [1, 2, 0, 20, 20, 0]);
});

test('rest raises health one stage for each full day', () => {
    assert.deepEqual(INJURY_DAYS, { minor: 3, serious: 10, grave: 30 });
    assert.equal(Object.isFrozen(INJURY_DAYS), true);
    assert.equal(healDays(5, 20, 1), 10);
    assert.equal(healDays(10, 20, 1), 15);
    assert.equal(healDays(15, 20, 1), 19);
    assert.equal(healDays(19, 20, 1), 20);
    assert.equal(healDays(5, 20, 2), 15);
    assert.equal(healDays(0, 20, 1), 5);
    assert.equal(healDays(5, 20, 0), 5);
    assert.equal(healDays(5, 20, 1.9), 10);
    assert.equal(healDays(20, 20, 99), 20);
    assert.equal(healDays(5, 0, 1), 0);
    assert.equal(healDays(null, 20, 1), 0);
    assert.equal(healDays(5, 20, 'rest'), 5);
    assert.equal(stageOf(healDays(5, 20, 1), 20), 'wounded');
    assert.equal(stageOf(healDays(10, 20, 1), 20), 'hurt');
    assert.equal(stageOf(healDays(15, 20, 1), 20), 'scratched');
});

test('gear totals are capped by the best rarity giving each stat', () => {
    assert.deepEqual(gearCap([]), {});
    assert.deepEqual(gearCap(null), {});
    assert.deepEqual(gearCap([{ rarity: 'common', bonus: { AGI: 2 } }]), { AGI: 1 });
    assert.deepEqual(gearCap([
        { rarity: 'rare', bonus: { AGI: 2 } },
        { rarity: 'common', bonus: { AGI: 2 } },
    ]), { AGI: 3 });
    assert.deepEqual(gearCap([{ rarity: 'mystic', bonus: { STR: 2 } }]), { STR: 1 });
    assert.deepEqual(gearCap([
        { rarity: 'legendary', bonus: { STR: 2 } },
        { rarity: 'epic', bonus: { STR: 4 } },
    ]), { STR: 5 });
    assert.deepEqual(gearCap([
        { rarity: 'common', bonus: { STR: 2, AGI: 1, CHA: 0 } },
        { rarity: 'uncommon', bonus: { AGI: 2, CHA: -3 } },
    ]), { STR: 1, AGI: 2 });
    assert.deepEqual(gearCap([{ rarity: 'common', bonus: null }, null, 'bad']), {});
});

test('effective stats stay within 1..30', () => {
    assert.equal(effectiveStat(13, 2), 15);
    assert.equal(effectiveStat(29, 5), 30);
    assert.equal(effectiveStat(1, -4), 1);
    assert.equal(effectiveStat(undefined, undefined), 1);
    assert.equal(effectiveStat('high', 2), 2);
});
