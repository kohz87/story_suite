// Builds the board's choices for the next acting member: attack, skills, items, flee, and the target label.

import { STAGES, stageWord } from '../../names.js';
import { readSheet } from '../../read.js';
import { applyGear } from '../../gear.js';
import { actionSkills } from '../plan.js';
import { attackStat, bestDefence, consumablesIn } from '../rules.js';
import { healingSkill, skillKey } from '../flags.js';

export function boardChoices(state, setup, chosen = [], memberGroupList = null) {
    const sheet = applyGear(readSheet(state), setup?.gear), actors = sheet.characters.filter(actor => actor.alive !== false && actor.health !== 0);
    const actor = actors.find(entry => !chosen.some(action => action.who === entry.who));
    const foes = sheet.foes.filter(foe => foe.filled && foe.hurt > 0);
    if (!actor) return { sheet, actors, foes, actor: null, choices: [] };
    const weapon = setup?.weapons?.[actor.key], stat = attackStat(actor, weapon).toUpperCase();
    const bars = setup?.bars === 2, paid = area => (area && bars ? 2 : 1);   // what plan.js and the roll charge: 1 of the resource, 2 for an area skill in a doubled-bars fight
    const choices = [{ label: `Attack${weapon?.name ? ` with ${weapon.name}` : ''} (${stat})`, view: { name: `Attack${weapon?.name ? ` with ${weapon.name}` : ''}`, stat }, action: { who: actor.who, kind: 'attack' } }];
    const areaLabel = Array.isArray(memberGroupList) && memberGroupList.length > 1 ? (setup?.aoe === 1 ? ' — every group' : ' — one group') : ' — every foe';
    for (const { skill, target, area, reason, areaReason } of actionSkills(actor, setup?.flags, { bars })) {
        const detail = [skill.stat?.toUpperCase(), skill.uses === 'mana' ? 'Mana' : 'Stamina'].filter(Boolean).join(', ');
        const base = `${skill.name}${skill.about ? `: ${skill.about}` : ''} (${detail})`;
        if (setup?.bars === 2 && healingSkill(skill) && target) {
            for (const mate of sheet.characters.filter(person => person.alive !== false)) choices.push({ label: `${base} — heal ${mate.who}`, reason, view: { name: `${skill.name} → ${mate.who}`, stat: skill.stat, uses: skill.uses, cost: paid(false), about: skill.about }, action: { who: actor.who, kind: 'skill', skill: skill.name, target: mate.who, support: true } });
            continue;
        }
        if (target) choices.push({ label: `${base}${area ? ' — one foe' : ''}`, reason, view: { name: `${skill.name}${area ? ' · one foe' : ''}`, stat: skill.stat, uses: skill.uses, cost: paid(false), about: skill.about }, action: { who: actor.who, kind: 'skill', skill: skill.name } });
        if (area) choices.push({ label: `${base}${areaLabel}`, reason: areaReason, view: { name: skill.name, stat: skill.stat, uses: skill.uses, cost: paid(true), area: true, about: skill.about }, action: { who: actor.who, kind: 'skill', skill: skill.name, area: true } });
    }
    // Use item (owner 14 Nov): the party's consumables, one per member per exchange; hidden while the bag has none (the units already chosen this exchange are not offered twice).
    const bag = consumablesIn(state?.domains?.inventory, chosen.filter(action => action.kind === 'item').map(action => action.stack));
    if (bag.length) choices.push({ label: 'Use item', view: { name: 'Use item', about: 'Use a consumable on yourself or an ally; it takes your action.' }, items: bag, action: { who: actor.who, kind: 'item' } });
    choices.push({ label: 'Flee', view: { name: 'Flee' }, action: { who: actor.who, kind: 'flee' } });
    const defence = bestDefence(actor, skill => setup?.flags?.[skillKey(actor.module, skill)]);
    return { sheet, actors, foes, actor, choices, defence: defence?.name ?? null, resources: resourcesOf(actor) };
}

/** The choosing member's Mana and Stamina as `{ value, max }` (blocks left, blocks in the bar); a bar of no size is null (no Mana: Stamina only). Null when the sheet has no block sizes. */
export function resourcesOf(actor) {
    const size = actor?.size;
    if (!size) return null;
    const pick = key => (Number.isFinite(size[key]) && size[key] > 0 ? { value: Math.max(0, Number(actor[key]) || 0), max: size[key] } : null);
    return { mana: pick('mana'), stamina: pick('stamina') };
}

export function targetLabel(foe) {
    const size = foe.size ?? 5, health = stageWord(STAGES.health, foe.hurt, size);
    return `${foe.name} (Lv ${foe.level}, ${health})`;
}
