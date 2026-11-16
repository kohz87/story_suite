// The witness hash of the sheet and equipped gear a board segment was rolled on.
import { condOf } from '../../../inventory/index.js';
import { hashJson } from '../../../../core/replay.js';
import { readSheet } from '../../read.js';
import { byId, gearQuery } from './shared-gear.js';

/** A segment's sheet and equipped pieces must still be the ones used to roll it. */
export function boardWitness(state, setup) {
    const domain = state?.domains?.dataModules, input = { sheet: readSheet(state), active: domain?.active ?? null, pins: domain?.pins ?? null };
    if (setup?.gear) {
        const query = gearQuery(state), inventory = state?.domains?.inventory;
        const owners = [...new Set(['party', ...Object.values(setup.gear.who ?? {}).flatMap(entry => entry.own ?? [])])].sort();
        input.gear = owners.map(owner => ({ owner, answer: query('inventory.gear', { owner }) }));
        input.equipped = Object.values(inventory?.stacks ?? {}).filter(stack => owners.includes(stack.owner) && stack.equipped)
            .sort(byId).map(stack => ({ id: stack.id, def: stack.def, owner: stack.owner, equipped: stack.equipped, cond: condOf(stack, inventory) }));
    }
    return hashJson(input);
}
