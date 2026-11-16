// What one owner's worn pieces soak: the record the fight engine will read, from the inventory state alone.

import { isPlainObject } from '../../common.js';
import { GEAR, soakFor } from '../stats.js';

/** `{ total, pieces: [{ place, name, soak }] }` for what `owner` has on (pieces that give soak only, in the order of GEAR.places). */
export function soakRecord(state, owner, condOf) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const worn = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {})
        .filter(stack => isPlainObject(stack) && stack.owner === owner && typeof stack.equipped === 'string' && isPlainObject(defs[stack.def]))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const pieces = [];
    for (const place of GEAR.places) {
        const stack = worn.find(other => other.equipped === place);
        const soak = stack ? soakFor(defs[stack.def], condOf(stack, inventory)) : 0;
        if (soak > 0) pieces.push({ place, name: defs[stack.def].name, soak });
    }
    return { total: pieces.reduce((sum, piece) => sum + piece.soak, 0), pieces };
}
