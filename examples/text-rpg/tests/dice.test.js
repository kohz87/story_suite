// Tests the text RPG's seeded dice, checked records and narrator note.
import test from 'node:test';
import assert from 'node:assert/strict';

import { isSeed, rng } from '../src/dice/rng.js';
import { DICE_COUNT, replyDice } from '../src/dice/roll.js';
import { diceOf, drawDice } from '../src/dice/record.js';
import { diceNote } from '../src/dice/note.js';

const DIFFICULTIES = [
    { word: 'easy', dc: 8 },
    { word: 'normal', dc: 12 },
    { word: 'hard', dc: 16 },
    { word: 'very hard', dc: 20 },
    { word: 'near impossible', dc: 24 },
];

const ROWS = [
    { who: 'Astra', bonuses: [['STR', 0], ['AGI', 2], ['Obscure', 4]] },
    { who: 'Bram', bonuses: [['CHA', 1], ['Persuade', 3]] },
];

const NOTE_WITHOUT_FLOOR =
    'Dice for this reply, in order: 12, 4, 17. ' +
    "Use one for each attempt that can fail (yours or a party member's): total = die + bonus, against easy 8, normal 12, hard 16, very hard 20, near impossible 24. " +
    'Total at the number or over: success; 1–2 short: success at a cost; more: failure; 10 or more short or a natural 1: a bad failure; a natural 20: more than asked. ' +
    'Bonus by stat or skill: Astra: STR+0 AGI+2; Obscure+4. Bram: CHA+1; Persuade+3. ' +
    'The story must follow each result strictly. Tell only what happens: dice, bonuses, totals and difficulty numbers never go in the story text. ' +
    "Report each: ? try Who | skill or stat | difficulty, where Who is the person rolling (the reader's character or a party member, by name), never the action; for example ? try Astra | Obscure | normal.";

const NOTE_WITH_FLOOR = NOTE_WITHOUT_FLOOR.replace(
    'more than asked. Bonus',
    'more than asked. Nothing this reply is easier than hard. Bonus',
);

test('isSeed: covers both uint32 bounds and rejects other values', () => {
    assert.equal(isSeed(0), true);
    assert.equal(isSeed(1), true);
    assert.equal(isSeed(0xFFFFFFFF), true);
    assert.equal(isSeed(-1), false);
    assert.equal(isSeed(0x100000000), false);
    assert.equal(isSeed(1.5), false);
    assert.equal(isSeed(Number.NaN), false);
    assert.equal(isSeed(Number.POSITIVE_INFINITY), false);
    assert.equal(isSeed('1'), false);
    assert.equal(isSeed(undefined), false);
    assert.equal(isSeed(null), false);
});

test('rng: same seed gives the same sequence and different seeds diverge', () => {
    const left = rng(12345);
    const right = rng(12345);
    const first = Array.from({ length: 20 }, () => left());
    const second = Array.from({ length: 20 }, () => right());
    assert.deepEqual(first, second);
    assert.equal(first.every(value => value >= 0 && value < 1), true);

    const one = rng(1);
    const two = rng(2);
    const fromOne = Array.from({ length: 6 }, () => one());
    const fromTwo = Array.from({ length: 6 }, () => two());
    assert.notDeepEqual(fromOne, fromTwo);
});

test('rng: a bad seed uses the safe seed-zero sequence', () => {
    const bad = rng('not a seed');
    const zero = rng(0);
    assert.deepEqual(
        Array.from({ length: 8 }, () => bad()),
        Array.from({ length: 8 }, () => zero()),
    );
});

test('rng: the copied generator matches the original for seed 12345', () => {
    const random = rng(12345);
    const expected = Array.from({ length: DICE_COUNT }, () => 1 + Math.floor(random() * 20));
    const actual = replyDice(12345);
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual, [11, 7, 14]);
});

test('replyDice: three d20 in order, deterministic and within bounds', () => {
    assert.equal(DICE_COUNT, 3);
    const dice = replyDice(12345);
    assert.equal(dice.length, DICE_COUNT);
    assert.equal(dice.every(die => Number.isInteger(die) && die >= 1 && die <= 20), true);
    assert.deepEqual(replyDice(12345), dice);
    assert.deepEqual(replyDice(1), [9, 16, 14]);
    assert.deepEqual(replyDice(2), [16, 12, 2]);
    assert.deepEqual(replyDice(undefined), replyDice(0));
});

test('diceOf: accepts three d20 and defaults a missing floor to easy', () => {
    assert.deepEqual(diceOf({ list: [1, 20, 7] }), { list: [1, 20, 7], floor: 0 });
    assert.deepEqual(diceOf({ list: [1, 20, 7], floor: 4 }), { list: [1, 20, 7], floor: 4 });
    const source = [1, 20, 7];
    const kept = diceOf({ list: source, floor: 2 });
    source[0] = 9;
    assert.deepEqual(kept, { list: [1, 20, 7], floor: 2 });
});

test('diceOf: rejects the wrong count, a die out of range and a bad floor', () => {
    assert.equal(diceOf(null), null);
    assert.equal(diceOf({}), null);
    assert.equal(diceOf({ list: '1,2,3' }), null);
    assert.equal(diceOf({ list: [1, 2] }), null);
    assert.equal(diceOf({ list: [1, 2, 3, 4] }), null);
    assert.equal(diceOf({ list: [1, 2, 21] }), null);
    assert.equal(diceOf({ list: [1, 2, 0] }), null);
    assert.equal(diceOf({ list: [1, 2, 3.5] }), null);
    assert.equal(diceOf({ list: [1, 2, 3], floor: -1 }), null);
    assert.equal(diceOf({ list: [1, 2, 3], floor: 5 }), null);
    assert.equal(diceOf({ list: [1, 2, 3], floor: 1.5 }), null);
    assert.equal(diceOf({ list: [1, 2, 3], floor: '2' }), null);
    assert.equal(diceOf({ list: [1, 2, 3], floor: null }), null);
});

test('drawDice: draws the seed sequence and clamps the floor safely', () => {
    assert.deepEqual(drawDice(12345, 2), { list: [11, 7, 14], floor: 2 });
    assert.deepEqual(drawDice(12345), { list: [11, 7, 14], floor: 0 });
    assert.equal(drawDice(12345, -3).floor, 0);
    assert.equal(drawDice(12345, 8).floor, 4);
    assert.equal(drawDice(12345, 2.9).floor, 2);
    assert.equal(drawDice(12345, Number.NaN).floor, 0);
    assert.equal(drawDice(12345, '3').floor, 0);
    assert.deepEqual(drawDice('bad', 9), { list: replyDice(0), floor: 4 });
});

test('diceNote: the exact note with and without a difficulty floor', () => {
    const base = { list: [12, 4, 17], rows: ROWS, difficulties: DIFFICULTIES };
    assert.equal(diceNote(base), NOTE_WITHOUT_FLOOR);
    assert.equal(diceNote({ ...base, floor: 0 }), NOTE_WITHOUT_FLOOR);
    assert.equal(diceNote({ ...base, floor: 2 }), NOTE_WITH_FLOOR);
});

test('diceNote: no dice or bad input gives the safe empty note', () => {
    assert.equal(diceNote(), '');
    assert.equal(diceNote(null), '');
    assert.equal(diceNote({}), '');
    assert.equal(diceNote({ list: [] }), '');
    assert.equal(diceNote({ list: [21, 0, '3'] }), '');
});

test('diceNote: defaults fill missing difficulties and omit an empty bonus table', () => {
    const note = diceNote({ list: [12, 4, 17] });
    assert.match(note, /against easy 8, normal 12, hard 16, very hard 20, near impossible 24\./);
    assert.doesNotMatch(note, /Bonus by stat or skill:/);
    assert.match(note, /for example \? try Astra \| Obscure \| normal\.$/);
});
