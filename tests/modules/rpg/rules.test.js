// The numbers a roll is made with (src/v2/lean-rpg/rules.js): the presets, the Custom ranges, and the settings that choose them. Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DIFFICULTIES, DIFFICULTY_SETTING, STANDARD, STANDARD_PRESETS, STANDARD_RANGES, STANDARD_RULE_KEYS, STANDARD_SETTING,
    difficultyOf, normalizeRules, presetOf, rulesFromSettings, sameRules,
} from '../../../modules/rpg/index.js';

const calm = () => () => () => 10;
const wessel = (over = {}) => ({ who: 'Wessel', skill: 'Iron Breath', stat: 'str', target: 'Sluice Rats', ...over });
const plan = (over = {}) => ({ formula: 'standard', pace: 'normal', acts: [wessel()], foes: [], checks: [], ...over });

const PRESETS = STANDARD_PRESETS;
const GENTLE = { success: 69, cost: 7, fail: 25 }, MIDDLE = { success: 61, cost: 8, fail: 31 }, HARSH = { success: 52, cost: 9, fail: 39 };

test('Standard is the one formula; Gentle and Harsh move the foe\'s base only', () => {
    assert.equal(STANDARD, PRESETS.standard);
    assert.deepEqual([PRESETS.gentle.foeBase, PRESETS.standard.foeBase, PRESETS.harsh.foeBase], [2, 4, 6]);
    for (const name of ['gentle', 'harsh']) assert.deepEqual({ ...PRESETS[name], foeBase: 4 }, { ...PRESETS.standard });
    assert.equal(PRESETS.standard.formula, 'standard');
    assert.deepEqual(DIFFICULTIES, ['gentle', 'standard', 'harsh', 'custom']);
    assert.ok(Object.isFrozen(PRESETS.standard) && Object.isFrozen(PRESETS));
    assert.deepEqual(Object.keys(normalizeRules()), STANDARD_RULE_KEYS);
});

test('Custom numbers are whole numbers inside their ranges, else Standard\'s; always the same keys in the same order', () => {
    assert.deepEqual(STANDARD_RANGES.foeBase, { min: 0, max: 15 });
    assert.deepEqual(STANDARD_RANGES.decisiveMargin, { min: 4, max: 15 });
    assert.deepEqual(STANDARD_RANGES.roundCap, { min: 1, max: 8 });
    assert.deepEqual(STANDARD_RANGES.costMargin, { min: 0, max: 5 });
    assert.deepEqual(normalizeRules({ foeBase: 15, classWeight: 3, costMargin: 0, decisiveMargin: 4, roundCap: 1 }), { ...STANDARD, foeBase: 15, classWeight: 3, costMargin: 0, decisiveMargin: 4, roundCap: 1 });
    // Out of range, not whole, not a number, missing: Standard's value for that number.
    const bad = normalizeRules({ foeBase: 16, classWeight: 0, costMargin: 2.5, decisiveMargin: '8', roundCap: 9, extra: 1 });
    assert.deepEqual(bad, STANDARD);
    assert.deepEqual(normalizeRules({ roundCap: 3, foeBase: -1 }), { ...STANDARD, roundCap: 3 });
    // A record with no `formula` replays as Standard.
    for (const nothing of [undefined, null, 5, 'x', [], [1]]) assert.deepEqual(normalizeRules(nothing), STANDARD);
    assert.equal(normalizeRules({ roundCap: 3 }).formula, 'standard');
    assert.equal(JSON.stringify(normalizeRules({ roundCap: 3, foeBase: 9 })), JSON.stringify(normalizeRules({ foeBase: 9, roundCap: 3 })), 'key order does not depend on how it was given');
});

test('the settings give the numbers: a preset by its word, Custom by its stored numbers, anything else Standard', () => {
    assert.equal(difficultyOf({}), 'standard');
    assert.equal(difficultyOf({ [DIFFICULTY_SETTING]: 'maybe' }), 'standard');
    // (From 2.17.0 every set the settings give also carries the level divisor, 5 unless the Custom numbers say 3 to 8: `levelled`.)
    const levelled = rules => ({ ...rules, levelDivisor: 5 });
    for (const name of ['gentle', 'standard', 'harsh']) assert.deepEqual(rulesFromSettings({ [DIFFICULTY_SETTING]: name }), levelled(PRESETS[name]));
    assert.deepEqual(rulesFromSettings({}), levelled(STANDARD));
    assert.deepEqual(rulesFromSettings({ [DIFFICULTY_SETTING]: 'custom', [STANDARD_SETTING]: { foeBase: 11, costMargin: 4, roundCap: 99 } }), levelled({ ...STANDARD, foeBase: 11, costMargin: 4 }));
    assert.deepEqual(rulesFromSettings({ [DIFFICULTY_SETTING]: 'custom' }), levelled(STANDARD), 'Custom with nothing stored');
    assert.deepEqual(rulesFromSettings({ [DIFFICULTY_SETTING]: 'gentle', [STANDARD_SETTING]: { foeBase: 11 } }), levelled(PRESETS.gentle), 'the custom numbers are not read for a preset');
    assert.notEqual(rulesFromSettings({}), STANDARD, 'a copy');
    assert.equal(presetOf(PRESETS.harsh), 'harsh');
    assert.equal(presetOf({ ...STANDARD, roundCap: 4 }), 'custom');
    assert.equal(sameRules(STANDARD, { roundCap: 8 }), true);
    assert.equal(sameRules(STANDARD, PRESETS.harsh), false);
});
