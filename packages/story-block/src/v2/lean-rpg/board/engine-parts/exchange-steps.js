// Steps inside one board exchange: using a bag item, weapon sides, the opening order.
import { statPart } from '../../formula.js';
import { readSheet } from '../../read.js';
import { hasLevels } from '../../rules.js';
import { prepareStandard, rollStandard } from '../../standard.js';
import { boardDice } from '../dice.js';
import { maxOf, recoverPool, recoveryOf, attackStat } from '../rules.js';

// One item used from the bag in a board exchange (owner 14 Nov): the stack must still hold one (the private copy has what the earlier staged exchanges
// left), the target's pool is restored on the copy, one unit goes. → { line, used } for the round, or { error }. The commit takes the unit itself (commit.js).
export function useItem(copy, item, number) {
    const inv = copy.domains.inventory, stack = inv?.stacks?.[item.stack], def = stack ? inv.defs?.[stack.def] : null;
    if (!stack || stack.qty < 1 || def?.kind !== 'consumable') return { error: `${item.who}'s item is no longer in the bag.` };
    if (typeof stack.bound === 'string' && stack.bound) return { error: `${def.name} is bound to its owner.` };
    const domain = copy.domains.dataModules, sheet = readSheet(copy), person = sheet.characters.find(entry => entry.who === item.target && entry.alive !== false);
    if (!person) return { error: 'That party member is no longer here.' };
    const { pool, blocks } = recoveryOf(def), move = recoverPool(domain, sheet, person, pool, blocks);
    stack.qty -= 1;
    if (stack.qty < 1) delete inv.stacks[stack.id];
    const { gained, pool: _pool, ...bar } = move;
    const line = { kind: 'check', type: 'item', support: true, skill: null, item: def.name, pool, gained, target: person.who, outcome: 'success', pc: { who: item.who, stat: '', die: 0, total: 0 }, ...(gained ? { damage: bar } : {}) };
    return { line, move: gained ? bar : null, used: { n: number, stack: stack.id, def: def.id, name: def.name, who: item.who, target: person.who, pool, gained } };
}

export function weaponSides(prepared, sheet, weapons) {
    for (const entry of prepared.acts) {
        if (entry.skill) continue;
        const actor = sheet.characters.find(character => character.key === entry.actor.slice(2));
        if (!actor) continue;
        const stat = attackStat(actor, weapons?.[actor.key]);
        const part = statPart('physical', actor.stats, { skillStat: stat });
        entry.pc = { ...entry.pc, stat: part.main, second: part.second, mainValue: actor.stats[part.main], secondValue: actor.stats[part.second], statBonus: part.value };
    }
}

export function openingOrder(state, setup, fightSheet, rules) {
    const plan = { formula: 'standard', pace: 'careful', acts: [], foes: [], checks: [] };
    const prepared = prepareStandard(plan, fightSheet, rules, { maxOf: maxOf(state.domains.dataModules), lv: hasLevels(rules), fix: true, then: true });
    return rollStandard(plan, prepared, boardDice(setup.seed, setup.offset + 1), rules,
        { carried: setup.order, flow: 2, fix: true, then: true, board: true }).order;
}
