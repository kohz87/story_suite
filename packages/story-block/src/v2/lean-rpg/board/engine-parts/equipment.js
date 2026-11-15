// Rebuilds the recorded owners' gear on the private copy and wears it down.
import { dressOf, wearGear } from '../../gear.js';
import { condWord, stepDown } from '../../../domains/gear.js';
import { condOf } from '../../../domains/inventory.js';
import { byId, gearQuery } from './shared-gear.js';

/** Rebuild the recorded owners' bonuses and weapons from the private, worn-down inventory. */
export function equipmentForBoard(state, recorded, liveQuery = null) {
    const query = liveQuery ?? gearQuery(state), party = query('inventory.gear', { owner: 'party' }) ?? {}, who = {}, weapons = {};
    const answerOf = owner => query('inventory.gear', { owner });
    for (const [key, entry] of Object.entries(recorded.who)) {
        // Wear changes condition and stat bonuses, but not the recorded carry penalty. A new
        // segment may refresh it from the live, feature-aware inventory query.
        const dress = dressOf(entry.own, party, answerOf), enc = liveQuery ? dress.enc : entry.enc;
        for (const answer of entry.own.map(answerOf)) {
            if (!weapons[key] && answer.slots?.weapon && !answer.slots.weapon.broken) weapons[key] = answer.slots.weapon;
        }
        who[key] = { own: structuredClone(entry.own), ...(dress.add ? { add: dress.add } : {}), ...(enc ? { enc } : {}), ...(dress.items ? { items: dress.items } : {}) };
    }
    return { gear: { v: recorded.v, who }, weapons };
}

// Only this private copy is mutated: the real event is written later by gear.wear on the reply.
export function stagingWear(state, gear, options) {
    const query = gearQuery(state), inventory = state.domains.inventory;
    const ctx = { query, call(_type, { owner, slot, steps }) {
        const stacks = Object.values(inventory?.stacks ?? {}).filter(stack => stack.owner === owner);
        const at = place => stacks.filter(stack => stack.equipped === place).sort(byId)[0];
        const stack = at(slot === 'defence' ? (at('body') ? 'body' : 'off-hand') : slot);
        const before = condOf(stack, inventory), now = stepDown(before, steps);
        stack.cond = now;
        if (inventory.condLog) delete inventory.condLog[stack.id];
        return { data: { before, now } };
    } };
    return wearGear(ctx, gear, { ...options, condWord });
}
