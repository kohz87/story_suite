import { hostAvailable } from '../../../testkit/index.js';
import { prepare, readSheet, rollPrepared } from '../../../src/v2/lean-rpg/index.js';
import { STANDARD_FORMULA } from '../../../src/v2/lean-rpg/rules.js';
import { prepareStandard as prepareMemberStandard, rollStandard as rollMemberStandard } from '../../../src/v2/lean-rpg/standard.js';
import { memberRolls } from '../../../src/v2/lean-rpg/board/member-rolls.js';
import { character, foeBlock, sheetDomain, skillBlock } from './helpers.js';

export const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const prepareStandard = (plan, sheet, rules, options) => prepareMemberStandard(plan, sheet, rules, { ...options, memberRolls: memberRolls(plan) });
export const rollStandard = (plan, prepared, source, rules, options) => rollMemberStandard(plan, prepared, source, rules, { ...options, memberRolls: memberRolls(plan) });

// ---- helpers ----------------------------------------------------------------------------------------------------------

// Wessel: STR 10, AGI 10, DEX 6, VIT 10 (6 Health blocks), Soul Class II; Ren: INT 16, DEX 10; a foe group of rats, class II (4 blocks).
export function party({ foes = [['Sluice Rats', 6, 2, 4]], wessel = {}, ren = {}, skills = {} } = {}) {
    return {
        wessel: { role: 'character', fields: character('Wessel', { health: 6, str: 10, vit: 10, agi: 10, dex: 6, int: 5, luk: 9, cha: 5, soul: 2, ...wessel }) },
        'wessel-skills': { role: 'skills', fields: skillBlock('Wessel', skills.wessel ?? [['Iron Breath', 2, 'str'], ['Spark', 0, 'int', 'mana']]) },
        ren: { role: 'character', fields: character('Ren', { health: 5, str: 5, vit: 5, agi: 8, dex: 10, int: 16, luk: 9, cha: 5, soul: 2, ...ren }) },
        'ren-skills': { role: 'skills', fields: skillBlock('Ren', skills.ren ?? [['Spark', 1, 'int', 'mana'], ['Mend', 0, 'int', 'mana']]) },
        foes: { role: 'foes', fields: foeBlock(foes) },
    };
}
export const sheetOf = (blocks = party()) => readSheet({ domains: { dataModules: sheetDomain(blocks) } });
export const std = (over = {}) => ({ ...STANDARD_FORMULA, ...over });
// Scripted dice: { 'act0': [pc, foe, …], 'foe0': […], 'init0': […] } by kind and place in the plan (init: character index, 16 + slot for a foe).
export const dice = (table = {}, fallback = 10) => (kind, at) => {
    const list = [...(table[`${kind}${at}`] ?? [])];
    return () => (list.length ? list.shift() : fallback);
};
export const planOf = (over = {}) => ({ formula: 'standard', pace: 'normal', acts: [], foes: [], checks: [], ...over });
export const roll = (plan, { blocks = party(), rules = std(), source = dice(), carried = null } = {}) => {
    const sheet = sheetOf(blocks), prepared = prepare(plan, sheet, rules);
    return { sheet, prepared, result: rollPrepared(plan, prepared, source, rules, { carried }) };
};
export const hit = { who: 'Wessel', skill: 'Iron Breath', target: 'Sluice Rats' };
// The bars a hit or a heal moved (a skill's cost also moves Stamina or Mana: see the cost tests).
export const bodies = hurts => hurts.filter(item => item.field === 'health' || /^hurt/.test(item.field));
