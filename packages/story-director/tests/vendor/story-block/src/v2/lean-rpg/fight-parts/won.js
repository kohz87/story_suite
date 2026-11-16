// Whether a fight is won on a sheet, and the groups a step may carry.

import { foeLevel } from './levels.js';
import { isObject, whole } from './shared-values.js';

/**
 * Whether the fight that began with the groups in `was` is won on `sheet`: some of those groups are still on the block and every filled group is Down.
 * → { won, groups: [{ slot, name, count, level }] (the fight's groups still there) }.
 */
export function fightOf(sheet, was) {
    const filled = sheet.foes.filter(foe => foe.filled);
    const groups = filled.filter(foe => was.includes(foe.slot)).map(foe => ({ slot: foe.slot, name: foe.name, count: foe.count, level: foeLevel(foe) }));
    return { won: groups.length > 0 && filled.every(foe => foe.hurt === 0), groups };
}

/** The `groups` a step may carry (see the top): [{ slot, name, count, level }] of the fight's own slots, one each, or null when damaged. */
export function groupsOf(value, was) {
    if (!Array.isArray(value) || !value.length || value.length > was.length) return null;
    const ok = value.every(group => isObject(group) && was.includes(group.slot) && typeof group.name === 'string' && group.name.length > 0 && group.name.length <= 120
        && whole(group.count) && group.count >= 1 && group.count <= 999 && whole(group.level) && group.level >= 1 && group.level <= 99);
    return ok && new Set(value.map(group => group.slot)).size === value.length ? value.map(({ slot, name, count, level }) => ({ slot, name, count, level })) : null;
}
