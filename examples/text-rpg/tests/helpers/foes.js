// A foes record made by hand for the deterministic tests: `groups` is [[name, count, threat index, left?]].
import { groupId } from '../../src/module-parts/foes-record.js';

/** Puts one fight's groups into the slice's foes record (as `+ foes` lines make them) and returns the slice. */
export function withFoes(slice, groups, fight = 'sw_before001') {
    slice.foes ??= { groups: {}, fights: {} };
    slice.foes.fights[fight] ??= { rolled: {}, taught: [] };
    for (const [name, count, threat, left = count] of groups) slice.foes.groups[groupId(name)] = { name, threat, count, left, fight };
    return slice;
}

/** The standing count of each group: `{ rats: 3 }`. */
export const leftOf = slice => Object.fromEntries(Object.entries(slice.foes?.groups ?? {}).map(([id, group]) => [id, group.left]));
