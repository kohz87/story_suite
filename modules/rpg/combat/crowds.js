// Foe groups as crowds, for the XP a win pays: the groups one split opened for a single crowd count as one group, whatever the slots they sit in.
import { V1 } from './numbers.js';

// The name a crowd goes by: a group's label without the member number (only a group of two or more has one) and without the split's " (n)".
const baseOf = group => group.label ? (group.count > 1 ? group.label.replace(/ \d+$/, '') : group.label).replace(/ \(\d+\)$/, '') : '';

/**
 * The groups as crowds: the groups a split opened for one crowd are one group again, so the XP does not depend on how a crowd was cut into slots. Groups merge when they share the base name, tier and level
 * (the record's labels); a record with no labels merges neighbours of the same mob or minion tier and level when the one before is a full group of six (what a split leaves). Different kinds stay apart.
 */
export function crowdsOf(groups) {
    const crowds = [], seen = new Map();
    for (const group of groups) {
        const name = baseOf(group), key = name ? `${name}\u0000${group.tier}\u0000${group.level}` : '', last = crowds.at(-1);
        const kept = key ? seen.get(key) : (last && !baseOf(last) && last.tier === group.tier && last.level === group.level && (group.tier === 'mob' || group.tier === 'minion')
            && last.part === V1.foe.groupMax && group.slot === last.end + 1 ? last : null);
        if (kept) { kept.count += group.count; kept.part = group.count; kept.end = group.slot; continue; }
        const crowd = { ...group, part: group.count, end: group.slot };
        crowds.push(crowd);
        if (key) seen.set(key, crowd);
    }
    return crowds;
}
