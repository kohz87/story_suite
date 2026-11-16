// What one owner's worn pieces soak: the record the fight engine will read, from the inventory state alone.

import { soakFor } from '../stats.js';
import { wornStacks } from './worn.js';

/** `{ total, pieces: [{ place, name, soak }] }` for what `owner` has on (pieces that give soak only, in the order of GEAR.places). */
export function soakRecord(state, owner, condOf) {
    const inventory = state?.domains?.inventory;
    const pieces = [];
    for (const [place, worn] of Object.entries(wornStacks(state, owner))) {
        const soak = worn ? soakFor(worn.def, condOf(worn.stack, inventory), place) : 0;
        if (soak > 0) pieces.push({ place, name: worn.def.name, soak });
    }
    return { total: pieces.reduce((sum, piece) => sum + piece.soak, 0), pieces };
}
