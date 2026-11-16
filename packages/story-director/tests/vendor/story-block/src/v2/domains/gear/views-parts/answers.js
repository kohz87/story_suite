// Answers what a wearer has on, the stats it gives, and the `inventory.gear` answer with the carry numbers.

import { isPlainObject } from '../../common.js';
import { GEAR } from '../stats.js';
import { statsFor } from '../stats.js';
import { carryPicture, atLimit, capacityFor } from '../carry.js';

const PLACES = GEAR.places;

/** What `owner` has on, by place: { weapon, body, 'off-hand', head, cloak, feet, 'accessory-1', 'accessory-2' } → { name, stats, cond, broken } | null. */
function wornBy(state, owner, condOf) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const worn = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {})
        .filter(stack => isPlainObject(stack) && stack.owner === owner && typeof stack.equipped === 'string' && isPlainObject(defs[stack.def]))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const out = {};
    for (const place of PLACES) {
        const stack = worn.find(other => other.equipped === place);
        if (!stack) { out[place] = null; continue; }
        const def = defs[stack.def];
        const cond = condOf(stack, inventory);
        out[place] = { name: def.name, stats: cond > 0 ? statsFor(def, stack) : {}, cond, broken: cond <= 0 };
    }
    return out;
}

/** `statBonus(owner)` → { STR, VIT, AGI, DEX, INT, LUK, CHA } summed over what the owner wears, broken pieces left out. */
export function statBonus(state, owner, condOf) {
    const total = Object.fromEntries(GEAR.stats.map(stat => [stat, 0]));
    for (const piece of Object.values(wornBy(state, owner, condOf))) if (piece) for (const [stat, n] of Object.entries(piece.stats)) total[stat] += n;
    return total;
}

/**
 * `inventory.gear { owner }`: what `owner` has on, the stats it gives, and what they carry:
 * { on, owner, slots: { weapon, body, off-hand, head, cloak, feet, accessory-1, accessory-2 }: { name, stats, cond, broken } | null,
 *   statBonus: { STR…CHA }, carry: { load, capacity, encumbered, penalty, sources } }.
 * A broken piece (cond 0) gives no stats. Part 2 adds `statBonus` to the effective stats (held to GEAR.effectiveMax).
 */
export function gearAnswer(state, args, { condOf, carryOf, penalty, mounts }) {
    const owner = typeof args?.owner === 'string' && args.owner ? args.owner : 'party';
    const picture = carryPicture(state, { carryOf, mounts });
    const mine = owner === 'party' ? picture.shared : picture.people.find(person => person.id === owner) ?? { load: 0, capacity: capacityFor(null) };
    const over = atLimit(mine.load, mine.capacity);
    return {
        on: true, owner, slots: wornBy(state, owner, condOf), statBonus: statBonus(state, owner, condOf),
        carry: { load: mine.load, capacity: mine.capacity, encumbered: over, penalty: over ? penalty : 0, sources: picture.sources[owner] ?? [{ name: owner, carry: capacityFor(null) }] },
    };
}
