// Which stack of `owner`'s is worn at each place: the one lookup `inventory.gear` slots and the soak record share.

import { isPlainObject } from '../../../scene/domains/common.js';
import { GEAR } from '../stats.js';

/** `{ [place]: { stack, def } | null }` for every GEAR.places key: the lowest-id stack of `owner` worn there whose def exists. */
export function wornStacks(state, owner) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const worn = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {})
        .filter(stack => isPlainObject(stack) && stack.owner === owner && typeof stack.equipped === 'string' && isPlainObject(defs[stack.def]))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const out = {};
    for (const place of GEAR.places) {
        const stack = worn.find(other => other.equipped === place);
        out[place] = stack ? { stack, def: defs[stack.def] } : null;
    }
    return out;
}
