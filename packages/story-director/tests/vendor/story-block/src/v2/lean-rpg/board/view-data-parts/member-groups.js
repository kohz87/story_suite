// Groups the standing members by real foe slot and words the member fight's turn order.

import { areaGroupName, memberBaseName, memberOrderEntries, pluralName } from '../order.js';
import { standingMembers } from './members.js';

/** The standing real-slot groups, each with the display name an area asks for. */
export function memberGroups(members, realFoes = [], { aoe = false } = {}) {
    const list = standingMembers(members), out = [], seen = new Set();
    for (const member of list) {
        const group = Number(member?.group);
        if (!Number.isFinite(group) || seen.has(group)) continue;
        seen.add(group);
        const real = (Array.isArray(realFoes) ? realFoes : []).find(foe => Number(foe?.slot) === group);
        out.push({ group, label: aoe && real ? areaGroupName(real) : pluralName(memberBaseName(member, real)), members: list.filter(item => Number(item?.group) === group) });
    }
    return out;
}

/**
 * The member fight's turn-order sentence: one entry per rolled group (its member numbers in brackets), then the attacks
 * the reader faces each exchange. Down members remain in the group's shared roll; only standing members attack.
 */
export function memberOrderLine(order, members, realFoes = []) {
    const list = standingMembers(members);
    const parts = memberOrderEntries(order, members, realFoes).map(item => item.name).filter(Boolean);
    const attacks = list.reduce((sum, member) => sum + Math.max(0, Math.trunc(Number(member?.attacks) || 0)), 0);
    if (attacks) parts.push(`${attacks} ${attacks === 1 ? 'attack' : 'attacks'} on you each exchange`);
    return parts.length ? `Order: ${parts.join(' · ')}` : '';
}
