import test from 'node:test';
import assert from 'node:assert/strict';
import { replyDice, offerLine, dicePayload, diceOf, diceRecord } from '../../../../modules/rpg/checks/dice.js';
import { bonusTable } from '../../../../modules/rpg/checks/result.js';
import { LIMITS } from '../../../../modules/rpg/names.js';
import { rulesOf } from '../../../../modules/rpg/checks/dice-parts/shared-checks.js';

const astra = { name: 'Astra', aliases: [], stats: { str: 10, vit: 8, agi: 12, dex: 6, int: 14, luk: 9, cha: 10 }, level: 10, soul: 1,
    skills: [{ name: 'Obscure', stat: 'dex', rank: 1, type: 'utility' }, { name: 'Lore', stat: null, rank: 0, type: 'utility' }] };
const rules = { roll: 1, decisiveMargin: 8 };

test('a reply gets three whole d20 from its seed, and the same seed gives the same dice', () => {
    const first = replyDice(0x1234abcd), again = replyDice(0x1234abcd), other = replyDice(0x1234abce);
    assert.equal(first.length, 3);
    assert.ok(first.every(die => Number.isInteger(die) && die >= 1 && die <= 20), String(first));
    assert.deepEqual(again, first);
    assert.notDeepEqual(other, first);
});

test('the note tells the dice, the difficulty numbers, the success rule and each member\'s exact bonus for every stat and skill', () => {
    const record = { list: [9, 17, 4], rules, dc: { ...LIMITS.dc }, perUse: 3, table: bonusTable([astra]) };
    // stat÷2 + level÷4 (STR 10: 5 + 2); a utility skill adds half its mastery rounded up (Obscure, Apprentice: 3 + 2 + 1); a skill with no stat leads with STR (Lore, Novice: 5 + 2 + 1)
    assert.equal(offerLine(record), 'Dice for this reply, in order: 9, 17, 4. Use one for each attempt that can fail (yours or a party member\'s): total = die + bonus, against easy 10 (routine for a trained person), normal 15 (a real chance to fail), hard 20 (a skilled person often fails), very hard 25 (rarely done). Total at the number or over: success; less: fail; a natural 1 always fails. Bonus by stat or skill (level included): Astra: STR+7 VIT+6 AGI+8 DEX+5 INT+9 LUK+6 CHA+7; Obscure+6, Lore+8. The checks take the dice in the order given. The story must follow each result strictly. Tell only what happens: dice, bonuses, totals and difficulty numbers never go in the story text. Report each: ? roll Who | skill or stat | difficulty, where Who is the person rolling (the reader\'s character or a party member, by name), never the action; for example ? roll Astra | Obscure | normal.');
});

test('the note names no cost outcome and no short margin, whatever the record holds', () => {
    const text = offerLine({ list: [1, 2, 3], rules: { ...rules, costMargin: 4 }, dc: { easy: 8, normal: 12, hard: 17, 'very hard': 22 }, table: [] });
    assert.ok(text.includes('easy 8') && text.includes('very hard 22'));
    assert.equal(/cost|short/u.test(text), false);
    assert.equal(text.includes('Bonus by'), false, 'no party: no bonus list');
    assert.ok(text.includes('for example ? roll Astra | Obscure | normal.'), 'no party: a stock example, no die');
});

test('a record is read back only whole (and only a v1 roll\'s): three dice in range, the rules mark, the difficulty numbers and a practice per use', () => {
    const good = { list: [9, 17, 4], rules, dc: { ...LIMITS.dc }, perUse: 3 };
    assert.deepEqual(diceOf(good), good);
    for (const bad of [null, { ...good, list: [9, 17] }, { ...good, list: [9, 17, 21] }, { ...good, rules: null }, { ...good, rules: { ...rules, decisiveMargin: 'eight' } }, { ...good, rules: { decisiveMargin: 8 } }, { ...good, rules: { levelDivisor: 5, classWeight: 2, costMargin: 2, decisiveMargin: 8 } }, { ...good, dc: { easy: 10 } }, { ...good, perUse: 9 }]) {
        assert.equal(diceOf(bad), null, JSON.stringify(bad));
    }
});

test('the payload records today\'s numbers once: the rules, the practice per use and the party\'s bonus table', () => {
    const payload = dicePayload([astra], { rpgPracticePerUse: 5, rpgDifficulty: 'harsh' });
    assert.equal(payload.perUse, 5);
    assert.deepEqual(payload.rules, { roll: 1, decisiveMargin: 8 }, 'the roll is v1 whatever the old difficulty setting says');
    assert.ok(diceOf({ list: [1, 2, 3], ...payload }), 'a fresh payload is a record diceOf keeps, so its lines are worked');
    assert.deepEqual(payload.dc, LIMITS.dc);
    assert.equal(payload.table[0].who, 'Astra');
    assert.equal(payload.table[0].stats.length, 7);
});

test('the prelude records the dice from the seed and keeps the payload to replan with', () => {
    const ctx = { cause: 'system', caller: null, rng: () => 0.25, fail: (code, message) => { throw new Error(`${code} ${message}`); } };
    const payload = dicePayload([astra], {});
    const made = diceRecord(ctx, payload);
    assert.equal(made.replan, true);
    assert.deepEqual(made.data.v2.dice.list, replyDice(Math.floor(0.25 * 4294967296) >>> 0));
    assert.deepEqual(made.data.v2.dice.table, payload.table);
    assert.deepEqual(made.data.v2.dice.rules, payload.rules);
    assert.deepEqual(diceRecord(ctx, { rules: { roll: 1, decisiveMargin: 'x' } }).data.v2.dice.rules, rulesOf(), 'damaged numbers are not kept: v1\'s are');
    assert.deepEqual(diceRecord(ctx, { rules: { costMargin: 99 } }).data.v2.dice.rules, rulesOf(), 'a record without the v1 mark is not kept');
    assert.throws(() => diceRecord({ ...ctx, cause: 'ui' }, payload), /REFUSED/u);
});

test('the note says check numbers stay out of the story, and the checks take the dice in order', () => {
    const SENTENCE = ' Tell only what happens: dice, bonuses, totals and difficulty numbers never go in the story text.';
    const text = offerLine({ list: [1, 2, 3], rules, dc: { ...LIMITS.dc }, perUse: 3, table: '' });
    assert.ok(text.includes(`The checks take the dice in the order given. The story must follow each result strictly.${SENTENCE} Report each:`));
});
