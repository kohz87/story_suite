// Tests for the stat, rank and pool word tables under src/words.

import test from 'node:test';
import assert from 'node:assert/strict';

import { STAT_KEYS, DEFAULT_STAT_WORDS, statBand, statWord } from '../src/words/stats.js';
import { RANKS, PRACTICE_MAX, rankOf } from '../src/words/ranks.js';
import { HEALTH_STAGES, ENERGY_STAGES, stageOf, usesLeft } from '../src/words/pools.js';

test('stats: the keys and the default table are exact and frozen', () => {
    assert.deepEqual(STAT_KEYS, ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);
    assert.equal(Object.isFrozen(STAT_KEYS), true);
    assert.deepEqual(DEFAULT_STAT_WORDS, {
        str: ['feeble', 'ordinary', 'strong', 'very strong', 'mighty', 'superhuman'],
        vit: ['frail', 'ordinary', 'hardy', 'tireless', 'iron-bodied', 'unbreakable'],
        agi: ['sluggish', 'ordinary', 'quick', 'fast', 'blurring', 'superhuman'],
        dex: ['fumbling', 'ordinary', 'deft', 'precise', 'flawless', 'superhuman'],
        int: ['slow-witted', 'ordinary', 'sharp', 'brilliant', 'a rare mind', 'genius beyond peers'],
        wis: ['heedless', 'ordinary', 'perceptive', 'insightful', 'far-seeing', 'sage'],
        cha: ['off-putting', 'ordinary', 'likeable', 'commanding', 'magnetic', 'legendary presence'],
    });
    assert.equal(Object.isFrozen(DEFAULT_STAT_WORDS), true);
    for (const key of STAT_KEYS) {
        assert.equal(DEFAULT_STAT_WORDS[key].length, 6, `${key} has one word per band`);
        assert.equal(Object.isFrozen(DEFAULT_STAT_WORDS[key]), true, `${key} words are frozen`);
    }
});

test('statBand: all bands, both clamps and non-number fallback', () => {
    const cases = [
        [-10, 0], [0, 0], [0.999, 0],
        [1, 0], [4, 0], [4.999, 0],
        [5, 1], [9, 1], [9.999, 1],
        [10, 2], [14, 2], [14.999, 2],
        [15, 3], [19, 3], [19.999, 3],
        [20, 4], [24, 4], [24.999, 4],
        [25, 5], [30, 5], [31, 5],
    ];
    for (const [value, band] of cases) assert.equal(statBand(value), band, `statBand(${value})`);
    assert.equal(statBand(Infinity), 5);
    assert.equal(statBand(-Infinity), 0);
    for (const value of [NaN, undefined, null, '13', true, {}, []]) assert.equal(statBand(value), 1, `${String(value)} is bad input`);
});

test('statWord: the required examples, band edges and unknown stats', () => {
    assert.equal(statWord('agi', 13), 'quick');
    assert.equal(statWord('agi', 15), 'fast');
    assert.equal(statWord('str', 30), 'superhuman');
    assert.equal(statWord('cha', 2), 'off-putting');
    assert.equal(statWord('str', 4), 'feeble');
    assert.equal(statWord('str', 5), 'ordinary');
    assert.equal(statWord('int', 20), 'a rare mind');
    assert.equal(statWord('int', 25), 'genius beyond peers');
    assert.equal(statWord('wis', 0), 'heedless');
    assert.equal(statWord('wis', 31), 'sage');
    assert.equal(statWord('luck', 10), '');
    assert.equal(statWord('AGI', 10), '');
    assert.equal(statWord(undefined, 10), '');
    assert.equal(statWord('agi', 13, null), '');
    assert.equal(statWord('agi', 13, { agi: [] }), '');
    assert.equal(statWord('agi', 13, { agi: ['only'] }), '');
    assert.equal(statWord('agi', 13, { agi: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'c');
    assert.equal(statWord('agi', 13, { agi: ['a', 'b', null, 'd', 'e', 'f'] }), '');
});

test('ranks: the exact seven ranks and practice constants', () => {
    assert.deepEqual(RANKS, [
        { name: 'Novice', word: 'knows the basics', bonus: 0, at: 0 },
        { name: 'Apprentice', word: 'trained', bonus: 1, at: 40 },
        { name: 'Adept', word: 'skilled', bonus: 2, at: 100 },
        { name: 'Expert', word: 'expert', bonus: 3, at: 180 },
        { name: 'Master', word: 'a master', bonus: 4, at: 280 },
        { name: 'Grandmaster', word: 'among the best alive', bonus: 5, at: 420 },
        { name: 'Legend', word: 'legendary', bonus: 6, at: 600 },
    ]);
    assert.equal(Object.isFrozen(RANKS), true);
    for (const entry of RANKS) assert.equal(Object.isFrozen(entry), true);
    assert.equal(PRACTICE_MAX, 600);
});

test('rankOf: required examples, every boundary, clamping and bad input', () => {
    assert.deepEqual(rankOf(150), { index: 2, name: 'Adept', word: 'skilled', bonus: 2 });
    assert.deepEqual(rankOf(9999), { index: 6, name: 'Legend', word: 'legendary', bonus: 6 });
    const cases = [
        [0, 'Novice'], [39, 'Novice'], [39.9, 'Novice'],
        [40, 'Apprentice'], [99, 'Apprentice'],
        [100, 'Adept'], [179, 'Adept'],
        [180, 'Expert'], [279, 'Expert'],
        [280, 'Master'], [419, 'Master'],
        [420, 'Grandmaster'], [599, 'Grandmaster'],
        [600, 'Legend'],
    ];
    for (const [practice, name] of cases) assert.equal(rankOf(practice).name, name, `rankOf(${practice})`);
    assert.equal(rankOf(-5).name, 'Novice');
    assert.equal(rankOf(Infinity).name, 'Legend');
    assert.equal(rankOf(-Infinity).name, 'Novice');
    for (const value of [NaN, undefined, null, '250', {}, []]) assert.equal(rankOf(value).name, 'Novice', `${String(value)} is bad input`);
});

test('pools: exact stage lists and health examples', () => {
    assert.deepEqual(HEALTH_STAGES, ['Unhurt', 'Scratched', 'Hurt', 'Wounded', 'Badly wounded', 'Down']);
    assert.deepEqual(ENERGY_STAGES, ['Fresh', 'Steady', 'Low', 'Drained', 'Empty']);
    assert.equal(Object.isFrozen(HEALTH_STAGES), true);
    assert.equal(Object.isFrozen(ENERGY_STAGES), true);

    assert.deepEqual(stageOf(10, 20, 'health'), { index: 3, word: 'Wounded' });
    assert.deepEqual(stageOf(0, 20, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf(20, 20, 'health'), { index: 0, word: 'Unhurt' });
    assert.deepEqual(stageOf(16, 20, 'health'), { index: 1, word: 'Scratched' });
    assert.deepEqual(stageOf(15.999, 20, 'health'), { index: 2, word: 'Hurt' });
    assert.deepEqual(stageOf(11, 20, 'health'), { index: 2, word: 'Hurt' });
    assert.deepEqual(stageOf(10.999, 20, 'health'), { index: 3, word: 'Wounded' });
    assert.deepEqual(stageOf(6, 20, 'health'), { index: 3, word: 'Wounded' });
    assert.deepEqual(stageOf(5.999, 20, 'health'), { index: 4, word: 'Badly wounded' });
    assert.deepEqual(stageOf(1, 20, 'health'), { index: 4, word: 'Badly wounded' });
    assert.deepEqual(stageOf(-1, 20, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf(30, 20, 'health'), { index: 0, word: 'Unhurt' });
});

test('pools: energy stages, unusable maxima and bad input', () => {
    assert.deepEqual(stageOf(20, 20, 'energy'), { index: 0, word: 'Fresh' });
    assert.deepEqual(stageOf(16, 20, 'energy'), { index: 0, word: 'Fresh' });
    assert.deepEqual(stageOf(15.999, 20, 'energy'), { index: 1, word: 'Steady' });
    assert.deepEqual(stageOf(11, 20, 'energy'), { index: 1, word: 'Steady' });
    assert.deepEqual(stageOf(10.999, 20, 'energy'), { index: 2, word: 'Low' });
    assert.deepEqual(stageOf(6, 20, 'energy'), { index: 2, word: 'Low' });
    assert.deepEqual(stageOf(5.999, 20, 'energy'), { index: 3, word: 'Drained' });
    assert.deepEqual(stageOf(1, 20, 'energy'), { index: 3, word: 'Drained' });
    assert.deepEqual(stageOf(0, 20, 'energy'), { index: 4, word: 'Empty' });
    assert.deepEqual(stageOf(-1, 20, 'energy'), { index: 4, word: 'Empty' });
    assert.deepEqual(stageOf(10, 0, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf(10, 0, 'energy'), { index: 4, word: 'Empty' });
    assert.deepEqual(stageOf(10, -5, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf(10, -5, 'energy'), { index: 4, word: 'Empty' });
    assert.deepEqual(stageOf(10, NaN, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf(NaN, 20, 'health'), { index: 5, word: 'Down' });
    assert.deepEqual(stageOf('10', 20, 'energy'), { index: 4, word: 'Empty' });
    assert.deepEqual(stageOf(10, 20, 'stamina'), { index: 3, word: 'Wounded' });
});

test('usesLeft: the required example, partial uses and bad input', () => {
    assert.equal(usesLeft(7, 3), 2);
    assert.equal(usesLeft(2, 3), 0);
    assert.equal(usesLeft(3, 3), 1);
    assert.equal(usesLeft(7, 2.5), 2);
    assert.equal(usesLeft(7, 0), 0);
    assert.equal(usesLeft(7, -3), 0);
    assert.equal(usesLeft(7, NaN), 0);
    assert.equal(usesLeft(NaN, 3), 0);
    assert.equal(usesLeft('7', 3), 0);
    assert.equal(usesLeft(-7, 3), 0);
    assert.equal(usesLeft(Infinity, 3), 0);
});
