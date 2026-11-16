import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckLine, validateCheck } from '../../../../modules/rpg/checks/line.js';
import { bonusTable, resolveCheck, workChecks } from '../../../../modules/rpg/checks/result.js';
import { rulesOf } from '../../../../modules/rpg/checks/dice-parts/shared-checks.js';

const member = { name: 'Astra', aliases: [], stats: { str: 10, vit: 8, agi: 12, dex: 6, int: 14, luk: 9, cha: 10 },
    skills: [{ name: 'Obscure', stat: 'dex', rank: 1, type: 'utility' }, { name: 'Iron Breath', stat: 'str', rank: 3, type: 'combat' }] };
member.level = 10;
const party = [member];
const check = (what, difficulty, die) => validateCheck(parseCheckLine(`? roll Astra | ${what} | ${difficulty} | ${die}`), { party, offeredDice: [die], usedDice: [] });

test('success and fail follow the v1 roll: d20 + stat÷2 + level÷4; there is no cost outcome', () => {
    const success = resolveCheck(check('CHA', 'normal', 13), 13);
    assert.deepEqual([success.bonus, success.total, success.outcome, success.decisive], [7, 20, 'success', false], 'CHA 10 ÷ 2 = 5, level 10 ÷ 4 = 2');
    assert.equal(success.practice, null);
    const tie = resolveCheck(check('CHA', 'normal', 8), 8);
    assert.deepEqual([tie.total, tie.outcome], [15, 'success'], 'a tie with the number succeeds');
    const short = resolveCheck(check('CHA', 'normal', 7), 7);
    assert.deepEqual([short.total, short.outcome, short.decisive], [14, 'fail', false], 'one short is a fail, never "at a cost"');
});

test('a utility skill adds half its mastery (rounded up); other skills add none; the practice use is one, never XP', () => {
    const utility = resolveCheck(check('Obscure', 'normal', 9), 9);
    assert.deepEqual([utility.bonus, utility.total, utility.outcome], [6, 15, 'success'], 'DEX 6 ÷ 2 = 3, level 2, Adept mastery 2 → +1');
    assert.deepEqual(utility.practice, { who: 'Astra', skill: 'Obscure', n: 1 });
    assert.equal('xp' in utility, false);
    assert.equal(utility.utility, true);
    const combat = resolveCheck(check('Iron Breath', 'normal', 9), 9);
    assert.deepEqual([combat.bonus, combat.utility], [7, false], 'a rank-3 combat skill: STR 10 ÷ 2 + 2, no mastery');
});

test('decisive is a natural 20 that succeeds, or a success whose lead reaches the decisive margin of 8; a natural 1 always fails', () => {
    const natural = resolveCheck(check('CHA', 'normal', 20), 20);
    assert.deepEqual([natural.total, natural.outcome, natural.decisive], [27, 'success', true]);
    const margin = resolveCheck(check('Iron Breath', 'easy', 11), 11);
    assert.deepEqual([margin.total, margin.outcome, margin.decisive], [18, 'success', true], 'lead 8 over easy 10');
    const lead7 = resolveCheck(check('Iron Breath', 'easy', 10), 10);
    assert.deepEqual([lead7.total, lead7.decisive], [17, false]);
    const one = resolveCheck(check('CHA', 'easy', 1), 1);
    assert.equal(one.outcome, 'fail');
    const strong = resolveCheck(validateCheck(parseCheckLine('? roll Hero | STR | easy | 1'), { party: [{ ...member, name: 'Hero', stats: { ...member.stats, str: 30 }, level: 99 }], offeredDice: [1], usedDice: [] }), 1);
    assert.deepEqual([strong.total >= 10, strong.outcome], [true, 'fail'], 'a natural 1 fails even when the total reaches the number');
});

test('the bonus the narrator is told for each stat and skill is exactly the bonus the result adds', () => {
    const [row] = bonusTable(party);
    const stats = ['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha'];
    assert.deepEqual(row.stats, [7, 6, 8, 5, 9, 6, 7]);
    assert.deepEqual(row.skills, [['Obscure', 6], ['Iron Breath', 7]]);
    stats.forEach((stat, at) => assert.equal(resolveCheck(check(stat.toUpperCase(), 'normal', 9), 9).bonus, row.stats[at], stat));
    for (const [name, bonus] of row.skills) assert.equal(resolveCheck(check(name, 'normal', 9), 9).bonus, bonus, name);
});

test('a skill with no stored stat leads with the type\'s main stat (STR), in the table and in the result', () => {
    const old = { ...member, name: 'Brin', skills: [{ name: 'Lore', stat: null, rank: 2, type: 'utility' }] };
    const found = validateCheck(parseCheckLine('? roll Brin | Lore | normal | 9'), { party: [old], offeredDice: [9], usedDice: [] });
    const done = resolveCheck(found, 9);
    assert.equal(done.stat, 'str');
    assert.equal(done.bonus, 5 + 2 + 2, 'STR 10 ÷ 2, level 2, Expert mastery 3 → +2');
    assert.equal(bonusTable([old])[0].skills[0][1], done.bonus);
});

test('workChecks uses the rules, difficulty numbers and practice recorded with the dice, never other numbers', () => {
    const dice = { list: [9, 17, 4], rules: rulesOf(), dc: { easy: 8, normal: 12, hard: 17, 'very hard': 22 }, perUse: 5 };
    const lines = ['? roll Astra | Obscure | normal | 9', '? roll Astra | CHA | normal | 4', '? roll Nobody | CHA | easy | 17'];
    const worked = workChecks([member, { ...member, name: 'Rook' }], lines, dice);
    assert.equal(worked.results.length, 1, 'the second line is out of order and the third has no one: refused');
    assert.equal(worked.notes.length, 2);
    const [first] = worked.results;
    assert.equal(first.dc, 12);
    assert.equal(first.practiceGained, 5);
    assert.deepEqual(worked.uses, [{ who: 'Astra', skill: 'Obscure', n: 1 }]);
    assert.equal(workChecks(party, lines, null).results.length, 0, 'no dice recorded: none used');
    assert.ok(workChecks(party, lines, null).notes.every(note => note.includes('no dice were offered')));
});

test('with the note\'s table a check is worked at the bonuses the note showed, not the sheet\'s newer ones', () => {
    const shown = bonusTable(party);
    const raised = { ...member, stats: { ...member.stats, cha: 20 }, skills: [...member.skills, { name: 'Fresh', stat: 'dex', rank: 2, type: 'utility' }] };
    const dice = { list: [10, 10, 10], rules: rulesOf(), dc: { easy: 8, normal: 12, hard: 16, extreme: 20 }, perUse: 3 };
    const line = what => `? roll Astra | ${what} | normal | 10`;
    const stat = workChecks([raised], [line('CHA')], dice, shown).results[0];
    assert.equal(stat.bonus, shown[0].stats[6], 'the table\'s CHA, not the raised one');
    assert.equal(stat.total, 10 + shown[0].stats[6]);
    assert.equal(stat.unlisted, undefined);
    const skill = workChecks([raised], [line('Obscure')], dice, shown).results[0];
    assert.equal(skill.bonus, shown[0].skills[0][1]);
    const live = workChecks([raised], [line('CHA')], dice).results[0];
    assert.notEqual(live.bonus, stat.bonus, 'no table: the sheet\'s bonus, as before');
});

test('a member or skill the table did not show rolls with no bonus, and the notes say why', () => {
    const shown = bonusTable(party);
    const raised = { ...member, skills: [...member.skills, { name: 'Fresh', stat: 'dex', rank: 2, type: 'utility' }] };
    const joined = { name: 'Newcomer', aliases: [], stats: member.stats, level: 10, skills: [] };
    const dice = { list: [10, 10, 10], rules: rulesOf(), dc: { easy: 8, normal: 12, hard: 16, extreme: 20 }, perUse: 3 };
    const out = workChecks([raised, joined], ['? roll Newcomer | CHA | normal | 10', '? roll Astra | Fresh | normal | 10'], dice, shown);
    assert.deepEqual(out.results.map(r => [r.who, r.bonus, r.total, r.unlisted]), [['Newcomer', 0, 10, 'member'], ['Astra', 0, 10, 'skill']]);
    assert.equal(out.notes.length, 2);
    assert.match(out.notes[0], /Newcomer rolled CHA with no bonus: they were not in the table the note showed/u);
    assert.match(out.notes[1], /Fresh with no bonus: it was not in the table/u);
});
