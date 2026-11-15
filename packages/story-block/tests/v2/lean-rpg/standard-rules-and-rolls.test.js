// The Standard stat formula's roll engine (src/v2/lean-rpg/standard/roll.js, re-exported by standard.js; rules.js, plan.js, cue.js):
// the recorded rules, the plan, and the typed roll with its breakdown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../../../src/v2/lean-rpg/index.js';
import { STANDARD_FORMULA, STANDARD_PRESETS, STANDARD_RULE_KEYS, oddsFor, presetOf, rulesFromSettings, sameRules, subjectOdds, oddsSubject, STANDARD_SETTING, DIFFICULTY_SETTING, normalizeRules } from '../../../src/v2/lean-rpg/rules.js';
import { judge } from '../../../src/v2/lean-rpg/standard.js';
import { hashJson } from '../../../src/v2/replay.js';
import { bodies, dice, hit, party, planOf, roll, sheetOf } from './standard.helpers.js';

// ---- the recorded rules -----------------------------------------------------------------------------------------------

test('Standard carries its formula and numbers in the rules; Gentle, Standard and Harsh move only the foe\'s base', () => {
    const rules = difficulty => rulesFromSettings({ [DIFFICULTY_SETTING]: difficulty });
    assert.deepEqual(Object.keys(rules('standard')), [...STANDARD_RULE_KEYS, 'levelDivisor'], 'and, from 2.17.0, the level divisor last');
    assert.equal(rules('standard').formula, 'standard');
    assert.deepEqual(['gentle', 'standard', 'harsh'].map(name => rules(name).foeBase), [2, 4, 6]);
    for (const key of STANDARD_RULE_KEYS.filter(key => key !== 'foeBase')) assert.equal(rules('gentle')[key], rules('harsh')[key], key);
    assert.deepEqual(rules('standard'), { ...STANDARD_FORMULA, levelDivisor: 5 });
    // formula.js's own numbers are the starting point: only the preset's foeBase differs from them.
    assert.deepEqual({ ...rules('standard'), foeBase: 3, levelDivisor: undefined }, { formula: 'standard', foeBase: 3, foeClassWeight: 3, classWeight: 2, costMargin: 2, decisiveMargin: 8, roundCap: 8,
        startStat: 5, createPoints: 10, createMin: 3, createMax: 10, pointsPerSoul: 4, statMax: 20, quickStartMargin: 10, levelDivisor: undefined });
});

test('Custom Standard numbers are each held to their range, and the creation numbers must agree', () => {
    const custom = given => rulesFromSettings({ [DIFFICULTY_SETTING]: 'custom', [STANDARD_SETTING]: given });
    assert.deepEqual(custom({ foeBase: 9, quickStartMargin: 6, pointsPerSoul: 3 }), { ...STANDARD_FORMULA, foeBase: 9, quickStartMargin: 6, pointsPerSoul: 3, levelDivisor: 5 });
    assert.equal(custom({ foeBase: 99 }).foeBase, STANDARD_FORMULA.foeBase, 'out of range: the preset\'s');
    assert.equal(custom({ foeClassWeight: 0 }).foeClassWeight, STANDARD_FORMULA.foeClassWeight);
    assert.equal(custom({ foeBase: 'x' }).foeBase, STANDARD_FORMULA.foeBase);
    assert.equal(custom({ createMin: 9, startStat: 5 }).createMin, 3, 'a lowest stat above the start is not kept');
    assert.deepEqual(custom(undefined), { ...STANDARD_FORMULA, levelDivisor: 5 });
    assert.equal(custom({ formula: 'classic' }).formula, 'standard');
});

test('normalizeRules: a payload without a formula replays as Standard (the nine numbers and the shared four), whatever else it says', () => {
    assert.deepEqual(Object.keys(normalizeRules({ foeBase: 7 })), STANDARD_RULE_KEYS);
    assert.deepEqual(normalizeRules({ formula: 'classic', foeBase: 7 }), normalizeRules({ foeBase: 7 }));
    assert.deepEqual(normalizeRules(undefined), STANDARD_FORMULA);
    assert.deepEqual(normalizeRules({ formula: 'standard' }), { ...STANDARD_FORMULA });
    assert.deepEqual(normalizeRules({ formula: 'standard', foeBase: 5, junk: 1 }), { ...STANDARD_FORMULA, foeBase: 5 });
    assert.equal(hashJson(normalizeRules(STANDARD_PRESETS.harsh)), hashJson(STANDARD_PRESETS.harsh));
});

test('sameRules and presetOf tell the presets apart', () => {
    assert.equal(presetOf(STANDARD_PRESETS.harsh), 'harsh');
    assert.equal(presetOf({ ...STANDARD_PRESETS.standard, foeBase: 5 }), 'custom');
    assert.equal(sameRules(STANDARD_PRESETS.standard, STANDARD_PRESETS.harsh), false);
    assert.equal(sameRules(STANDARD_PRESETS.gentle, { ...STANDARD_PRESETS.gentle }), true);
});

test('the odds bar follows the formula in force: Standard puts the pair, the Soul Class and the rank against foeBase + 3 × class', () => {
    // Wessel, Iaijutsu-like: STR 10 + DEX 6/2, halved = 6, Soul Class II 4, Expert 2 → +12 against a class-II foe at base 4: 4 + 6 = 10.
    const rules = STANDARD_PRESETS.standard;
    const odds = oddsFor(rules, { bonus: 12, foeClass: 2 });
    let success = 0;
    for (let mine = 1; mine <= 20; mine += 1) for (let theirs = 1; theirs <= 20; theirs += 1) if (judge(mine, mine + 12, theirs, theirs + 10, rules).outcome === 'success') success += 1;
    assert.equal(odds.success, Math.round(success / 4));
    const subject = oddsSubject(sheetOf(), 'Wessel', { rankNames: ['Novice', 'Adept', 'Expert', 'Master'], soulNames: ['I', 'II'], fold: text => String(text).toLowerCase(), standard: true });
    assert.equal(subject.uses, 'stamina');
    const given = subjectOdds(rules, subject);
    assert.equal(given.bonus, 6 + 4 + 2, 'pair(10, 6) + Class II + Expert');
    assert.equal(given.success, odds.success);
});

// ---- the plan ---------------------------------------------------------------------------------------------------------

test('a Standard plan carries a type, a fitting stat, area and support, and needs no stat or defend; Classic plans refuse those keys', () => {
    const ok = planOf({ acts: [{ who: 'Wessel', target: 'Rats' }, { who: 'Ren', skill: 'Spark', type: 'magic', area: true, target: 'Rats' }, { who: 'Ren', skill: 'Mend', support: true, difficulty: 'normal', target: 'Wessel' }],
        foes: [{ slot: 1, target: 'Wessel', againstMagic: true }], checks: [{ who: 'Wessel', type: 'check', fit: 'agi', difficulty: 'hard' }] });
    assert.deepEqual(validatePlan(ok), { ok: true, errors: [] });
    const bad = (change, text) => assert.match(validatePlan(planOf(change)).errors.join(' '), text);
    bad({ acts: [{ who: 'W', target: 'R', type: 'defence' }] }, /type must be one of physical, magic, social, check/);
    bad({ acts: [{ who: 'W', target: 'R', support: true }] }, /needs difficulty/);
    bad({ acts: [{ who: 'W', target: 'R', area: true, support: true, difficulty: 'easy' }] }, /both support and area/);
    bad({ acts: [{ who: 'W', target: 'R', difficulty: 'easy' }] }, /only a support action/);
    bad({ acts: [{ who: 'W', target: 'R', fit: 'luck' }] }, /fit to be one of/);
    bad({ foes: [{ slot: 1, target: 'W', againstMagic: 'yes' }] }, /againstMagic must be true/);
    bad({ checks: [{ who: 'W', type: 'physical', difficulty: 'easy' }] }, /type must be social or check/);
    assert.match(validatePlan({ ...planOf(), formula: 'classic' }).errors.join(' '), /formula must be standard/);
    // A Classic plan: the new keys are not its keys, and its stat and defend are still asked for.
    const classic = change => validatePlan({ pace: 'normal', acts: [], foes: [], checks: [], ...change });
    assert.match(classic({ acts: [{ who: 'W', target: 'R', stat: 'str', type: 'physical' }] }).errors.join(' '), /"type", which a plan does not use/);
    assert.match(classic({ acts: [{ who: 'W', target: 'R' }] }).errors.join(' '), /needs stat/);
    assert.match(classic({ foes: [{ slot: 1, target: 'W' }] }).errors.join(' '), /needs defend/);
});

// ---- the typed roll ---------------------------------------------------------------------------------------------------

test('a physical roll: (skill stat + DEX/2)/2 + Soul Class + rank against d20 + foeBase + 3 × class, and a hit takes 1 block', () => {
    const { result, sheet } = roll(planOf({ pace: 'careful', acts: [hit] }), { source: dice({ act0: [14, 9] }) });
    const [line] = result.rounds[0].lines;
    assert.deepEqual(line.pc, { who: 'Wessel', type: 'physical', stat: 'str', second: 'dex', mainValue: 10, secondValue: 6, statBonus: 6, classValue: 2, classBonus: 4, rank: 2, window: { min: -1, max: 3 }, situation: 0, edge: 0, die: 14, total: 26 });
    assert.deepEqual(line.foe, { slot: 1, name: 'Sluice Rats', base: 4, classValue: 2, classBonus: 6, die: 9, total: 19 });
    assert.equal(line.outcome, 'success');
    assert.equal(line.decisive, false);
    assert.deepEqual(line.damage, { id: 'f:1', kind: 'foe', name: 'Sluice Rats', blocks: 1, from: 4, to: 3, size: 4 });
    assert.deepEqual(bodies(result.hurts), [{ id: 'f:1', kind: 'foe', name: 'Sluice Rats', module: 'pack.chat/foes', field: 'hurt1', from: 4, to: 3, size: 4 }]);
    assert.match(result.text, /Round 1: Wessel → Sluice Rats \(Iron Breath\): SUCCESS \(26 vs 19\), a hit/);
    assert.equal(sheet.characters.find(item => item.who === 'Wessel').health, 6, 'the roll reads the sheet and never writes it');
});

test('a decisive hit takes 2 blocks: the winner\'s natural 20, the loser\'s natural 1 or a lead of 8; the bar never goes below 0', () => {
    const one = (dieValues, foes = [['Sluice Rats', 6, 2, 5]]) => roll(planOf({ pace: 'careful', acts: [hit] }), { blocks: party({ foes }), source: dice({ act0: dieValues }) }).result;
    assert.equal(one([20, 10]).rounds[0].lines[0].damage.blocks, 2, 'natural 20');
    assert.equal(one([12, 1]).rounds[0].lines[0].damage.blocks, 2, 'the foe rolled a 1');
    assert.equal(one([18, 10]).rounds[0].lines[0].damage.blocks, 2, 'a lead of 10: 30 against 20');
    assert.equal(one([14, 10]).rounds[0].lines[0].damage.blocks, 1, '26 against 20');
    const last = one([20, 10], [['Sluice Rats', 6, 2, 1]]);
    assert.deepEqual(bodies(last.hurts).map(({ from, to }) => [from, to]), [[1, 0]]);
    assert.equal(last.rounds[0].lines[0].damage.blocks, 1, 'only the block that was left');
    assert.equal(last.stop, 'decisive');
});

test('success at a cost lands the hit; a fail takes no block from the foe, even a decisive one', () => {
    const one = dieValues => roll(planOf({ pace: 'careful', acts: [hit] }), { source: dice({ act0: dieValues }) }).result.rounds[0].lines[0];
    const cost = one([8, 10]);              // 8 + 12 = 20 against 20 is a success; 7 + 12 = 19 against 20 is at a cost
    assert.equal(cost.outcome, 'success');
    const near = one([7, 10]);
    assert.equal(near.outcome, 'cost');
    assert.equal(near.damage.blocks, 1);
    const fail = one([2, 20]);
    assert.equal(fail.outcome, 'fail');
    assert.equal(fail.decisive, true);
    assert.equal(fail.damage, undefined);
});

test('magic uses INT (or the skill\'s stat) with half DEX; a skill uses its own stat in the main slot; nothing is added on top', () => {
    const magic = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Spark', target: 'Sluice Rats' }] }), { source: dice({ act0: [10, 10] }) }).result.rounds[0].lines[0];
    assert.equal(magic.type, 'magic', 'a Mana skill is magic');
    assert.deepEqual([magic.pc.stat, magic.pc.second, magic.pc.statBonus, magic.pc.rank, magic.pc.classBonus], ['int', 'dex', 10, 1, 4]);
    assert.equal(magic.pc.total, 10 + 10 + 4 + 1);
    // A stamina skill is physical even when the planner said magic; a skill with another stat puts it in the main slot.
    const blocks = party({ skills: { wessel: [['Fleet Cut', 1, 'agi']] } });
    const agi = roll(planOf({ pace: 'careful', acts: [{ who: 'Wessel', skill: 'Fleet Cut', type: 'magic', target: 'Sluice Rats' }] }), { blocks, source: dice({ act0: [10, 10] }) }).result.rounds[0].lines[0];
    assert.deepEqual([agi.type, agi.pc.stat, agi.pc.second, agi.pc.statBonus], ['physical', 'agi', 'dex', 6]);
    // With no skill the plan's physical or magic decides, and the type's own stat is used.
    const bare = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', type: 'magic', target: 'Sluice Rats' }] })).result.rounds[0].lines[0];
    assert.deepEqual([bare.type, bare.pc.stat, bare.skill, bare.pc.rank], ['magic', 'int', null, 0]);
});

test('social and check rolls: CHA + INT/2 and the fitting stat + DEX/2; a social or check act against a foe harms nobody', () => {
    const talk = roll(planOf({ pace: 'careful', acts: [{ who: 'Wessel', type: 'social', target: 'Sluice Rats' }] }), { source: dice({ act0: [19, 10] }) }).result;
    const [line] = talk.rounds[0].lines;
    assert.deepEqual([line.type, line.pc.stat, line.pc.second, line.pc.statBonus, line.outcome, line.damage], ['social', 'cha', 'int', 3, 'success', undefined]);
    assert.deepEqual(talk.hurts, []);
    const check = roll(planOf({ checks: [{ who: 'Wessel', type: 'check', fit: 'agi', difficulty: 'normal' }] }), { source: dice({ check0: [9] }) }).result.checks[0];
    assert.deepEqual([check.type, check.pc.stat, check.pc.second, check.pc.statBonus, check.dc, check.pc.total, check.outcome], ['check', 'agi', 'dex', 6, 15, 9 + 6 + 4, 'success']);
    const lore = roll(planOf({ checks: [{ who: 'Ren', type: 'social', difficulty: 'hard' }] })).result.checks[0];
    assert.deepEqual([lore.pc.stat, lore.pc.second], ['cha', 'int']);
});

test('defence: the higher of AGI and VIT leads (a tie dodges), a spell is warded with INT or VIT; a hit on the defender takes 1 block, 2 when decisive', () => {
    const foe = target => planOf({ pace: 'careful', foes: [{ slot: 1, target, ...(target === 'Ren' ? { againstMagic: true } : {}) }], acts: [{ who: 'Wessel', skill: 'Iron Breath', target: 'Sluice Rats' }] });
    const tie = roll(foe('Wessel'), { source: dice({ foe0: [5, 12] }) }).result;
    const line = tie.rounds[0].lines.find(item => item.kind === 'foe');
    assert.deepEqual([line.type, line.pc.stat, line.pc.second, line.pc.style, line.pc.statBonus], ['defence', 'agi', 'vit', 'dodge', 7]);
    assert.equal(line.pc.total, 5 + 7 + 4);
    assert.equal(line.foe.total, 12 + 10);
    assert.equal(line.outcome, 'fail');
    assert.deepEqual(line.damage, { id: 'c:wessel', kind: 'char', name: 'Wessel', blocks: 1, from: 6, to: 5, size: 6 });
    assert.match(tie.text, /Sluice Rats attacks Wessel: FAIL for Wessel \(16 vs 22\), hits Wessel/);
    const heavy = roll(foe('Wessel'), { source: dice({ foe0: [3, 18] }) }).result.rounds[0].lines.find(item => item.kind === 'foe');
    assert.deepEqual([heavy.decisive, heavy.damage.blocks, heavy.damage.to], [true, 2, 4]);
    // VIT 14 leads over AGI 10: block. Against a spell Ren's INT 16 wards (second VIT 5); Wessel's INT 5 is below VIT 10, so he blocks.
    const block = roll(foe('Wessel'), { blocks: party({ wessel: { vit: 14 } }) }).result.rounds[0].lines.find(item => item.kind === 'foe');
    assert.deepEqual([block.pc.style, block.pc.stat, block.pc.second], ['block', 'vit', 'agi']);
    const ward = roll(foe('Ren')).result.rounds[0].lines.find(item => item.kind === 'foe');
    assert.deepEqual([ward.pc.style, ward.pc.stat, ward.pc.second, ward.pc.statBonus], ['ward', 'int', 'vit', 9]);
    const stopped = roll(foe('Wessel'), { source: dice({ foe0: [15, 5] }) }).result.rounds[0].lines.find(item => item.kind === 'foe');
    assert.equal(stopped.damage, undefined, 'a defence that holds takes nothing');
    assert.deepEqual(roll(foe('Wessel'), { source: dice({ foe0: [15, 5] }) }).result.hurts.filter(item => item.kind === 'char' && item.field === 'health'), []);
});

test('luck is a window on the edge: the situation\'s edge is held inside LUK\'s window and a best case reaches its top', () => {
    const edge = (luk, asked) => roll(planOf({ pace: 'careful', acts: [{ ...hit, edge: asked }] }), { blocks: party({ wessel: { luk } }), source: dice({ act0: [10, 10] }) }).result.rounds[0].lines[0].pc;
    // LUK 13: +1..+4. A best case (+3) is +4, a bad situation is lifted to +1, and the total carries the edge after the window.
    assert.deepEqual([edge(13, 3).window, edge(13, 3).situation, edge(13, 3).edge, edge(13, 3).total], [{ min: 1, max: 4 }, 3, 4, 10 + 12 + 4]);
    assert.deepEqual([edge(13, -2).edge, edge(13, 0).edge, edge(13, 2).edge], [1, 1, 2]);
    // LUK 5 (a fresh character): −2..+3.
    assert.deepEqual([-3, -2, 0, 3].map(asked => edge(5, asked).edge), [-2, -2, 0, 3]);
    assert.deepEqual([edge(3, -3).edge, edge(4, -3).edge, edge(7, -3).edge, edge(9, -3).edge, edge(11, -3).edge, edge(19, -3).edge, edge(19, 3).edge, edge(17, 3).edge], [-3, -3, -1, -1, 0, 3, 5, 5]);
    assert.equal(edge(9, 3).window.max, 3);
});

test('out of the resource: no skill, rank 0 and the type\'s own stat, and the cue says so; a skill the character lacks is rolled untrained', () => {
    const blocks = party({ ren: { mana: 0 } });
    const { result, prepared } = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Spark', type: 'magic', target: 'Sluice Rats' }] }), { blocks });
    const line = result.rounds[0].lines[0];
    assert.deepEqual([line.skill, line.pc.rank, line.pc.stat], [null, 0, 'int']);
    assert.deepEqual(prepared.refused.map(entry => entry.text), ['Ren cannot use Spark (Mana Empty): rolled without it.']);
    assert.match(result.text, /Ren cannot use Spark \(Mana Empty\): rolled without it\./);
    const stamina = roll(planOf({ pace: 'careful', acts: [hit] }), { blocks: party({ wessel: { stamina: 0 } }) }).result.rounds[0].lines[0];
    assert.deepEqual([stamina.skill, stamina.pc.rank, stamina.pc.stat], [null, 0, 'str']);
    const lacks = roll(planOf({ pace: 'careful', acts: [{ who: 'Wessel', skill: 'Fireball', type: 'magic', target: 'Sluice Rats' }] }));
    assert.deepEqual(lacks.prepared.refused.map(entry => entry.text), ['Wessel has no skill called Fireball: rolled untrained.']);
    assert.deepEqual([lacks.result.rounds[0].lines[0].type, lacks.result.rounds[0].lines[0].pc.stat], ['magic', 'int']);
});

test('area: one attack roll against each foe\'s own roll; the bars of each move on their own', () => {
    const foes = [['Rats', 2, 1, 4], ['Drake', 1, 2, 4]];
    const { result } = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Spark', area: true, target: 'Rats' }] }), { blocks: party({ foes }), source: dice({ act0: [12, 3, 17] }) });
    const lines = result.rounds[0].lines;
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map(line => line.area), [true, true]);
    assert.deepEqual(lines.map(line => line.pc.die), [12, 12], 'one roll');
    assert.deepEqual(lines.map(line => line.foe.die), [3, 17], 'against their own');
    assert.deepEqual(lines.map(line => line.outcome), ['success', 'success']);
    assert.deepEqual(lines.map(line => [line.foe.name, line.damage?.to]), [['Rats', 2], ['Drake', 3]]);
    // (Ren's 12 + 15 = 27 beats the Rats' 10 by 17, a decisive hit of 2 blocks, and just reaches the Drake's 17 + 10 = 27 for 1)
    assert.match(result.text, /Ren → Drake \(Spark\) \(area\)/);
});

test('support: a roll against a difficulty heals 1 block (2 decisive), never past the bar, nothing on a fail', () => {
    const mend = difficulty => planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Mend', support: true, difficulty, target: 'Wessel' }] });
    const heal = (wessel, dieValue, difficulty = 'normal') => roll(mend(difficulty), { blocks: party({ wessel }), source: dice({ act0: [dieValue, 10] }) }).result;
    const line = heal({ health: 3 }, 6).rounds[0].lines[0];          // 6 + (10 + 4 + 0) = 20 against 15
    assert.deepEqual([line.kind, line.support, line.target, line.outcome, line.dc, line.pc.total], ['check', true, 'Wessel', 'success', 15, 20]);
    assert.deepEqual(line.damage, { id: 'c:wessel', kind: 'char', name: 'Wessel', blocks: -1, from: 3, to: 4, size: 6 });
    assert.match(heal({ health: 3 }, 6).text, /Ren → Wessel \(Mend, support\): SUCCESS \(20 vs 15\), heals/);
    assert.equal(heal({ health: 3 }, 20).rounds[0].lines[0].damage.to, 5, 'a decisive heal gives 2');
    assert.deepEqual(heal({ health: 5 }, 20).rounds[0].lines[0].damage, { id: 'c:wessel', kind: 'char', name: 'Wessel', blocks: -1, from: 5, to: 6, size: 6 }, 'clamped to the bar');
    assert.equal(heal({ health: 6 }, 20).rounds[0].lines[0].damage, undefined, 'a full bar heals nothing');
    assert.equal(heal({ health: 3 }, 1).rounds[0].lines[0].damage, undefined, 'a fail heals nothing');
    assert.deepEqual(bodies(heal({ health: 0 }, 5).hurts).map(({ from, to }) => [from, to]), [[0, 1]], 'someone who is Down can be mended');
    assert.equal(heal({ health: 3 }, 5, 'hard').rounds[0].lines[0].outcome, 'cost', '19 against 20 is at a cost, and it still heals');
    assert.equal(heal({ health: 3 }, 5, 'hard').rounds[0].lines[0].damage.to, 4);
});
