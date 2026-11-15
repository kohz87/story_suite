// Builds the foe and party chips, the group target button and the staged action line.

import { memberBaseName } from '../order.js';
import { stageTone } from '../../view/party-data.js';
import { memberValue, sumOf, whole } from './shared-values.js';
import { standingMembers } from './members.js';

/** The foe groups as chips: one per real slot (a Down group stays, dimmed), "×N" the foes standing (a pack: about how many are left), Health the blocks left over the blocks in its bars. */
export function foeChips(members, realFoes = []) {
    const groups = new Map();
    for (const member of Array.isArray(members) ? members : []) {
        const group = Number(member?.group ?? member?.slot);
        if (Number.isFinite(group)) groups.set(group, [...(groups.get(group) ?? []), member]);
    }
    return [...groups].map(([group, list]) => {
        const real = (Array.isArray(realFoes) ? realFoes : []).find(foe => Number(foe?.slot) === group), up = standingMembers(list);
        const max = sumOf(list, member => Math.max(1, whole(member?.size))), value = Math.min(max, sumOf(list, memberValue));
        return { group, name: memberBaseName(list[0], real), level: real?.level, count: sumOf(up, member => (member?.pack ? whole(member.left) : 1)) || list.length, value, max, tone: stageTone(value, max) };
    });
}

/** The party as chips: name, level and Health blocks over its bar. */
export const partyChips = party => (Array.isArray(party) ? party : []).map(character => {
    const bar = character?.bars?.health ?? {}, max = whole(bar.max), value = Math.min(max, whole(bar.value));
    return { name: character?.name ?? '', level: character?.level, value, max, tone: stageTone(value, max) };
});

/** A group as a target button: its label ("1. Ridge hounds ×4") and Health. `group` carries the standing members. */
export function groupTarget(group, at) {
    const up = group.members, max = sumOf(up, member => Math.max(1, whole(member?.size))), value = Math.min(max, sumOf(up, memberValue));
    const count = sumOf(up, member => (member?.pack ? whole(member.left) : 1));
    return { label: `${at + 1}. ${group.label}${count > 1 ? ` ×${count}` : ''}`, value, max, tone: stageTone(value, max) };
}

/** The staged line for one chosen action: "Astra · Flash" for an area skill, "Astra · Cut → Bristle-boar 2" for one foe. */
export function stagedLine(action, targetName = '') {
    const what = action.kind === 'attack' ? 'Attack' : action.kind === 'flee' ? 'Flee' : action.kind === 'item' ? 'Use item' : action.skill ?? '';
    return `${action.who} · ${what}${!action.area && targetName ? ` → ${targetName}` : ''}`;
}
