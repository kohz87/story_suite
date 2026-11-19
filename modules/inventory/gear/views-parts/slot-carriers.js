// The Party paper-doll's Mount and Bag slots in `gear.view`: what `owner` rides and carries as a bag, and what the two pickers
// list (every mount with its riders and seats, every bag-like item the party holds with whose it is). The pickers' refusals
// (left behind, no seat free, bound to someone) are read from these rows; the commands (mounts.ride, inventory.bag) say them too.

import { ridersOf } from '../../../scene/mounts-parts/riders.js';
import { travelsWith } from '../carry-parts/mount-travel.js';
import { kindCarry } from '../carry-parts/mount-kinds.js';
import { bagLike } from '../carry-parts/bag-like.js';
import { BAG_PLACE } from '../../state-parts/carry.js';

const fold = text => String(text ?? '').normalize('NFKC').trim().toLowerCase();
const whole = (value, fallback) => (Number.isSafeInteger(value) && value > 0 ? value : fallback);

/**
 * { ride: { name, kind, pace, carry } | null, bag: { stack, name, carry } | null, mounts: [{ name, kind, pace, count, carry, riders, withParty, where }],
 *   packs: [{ stack, name, carry, owner, by, bag, bound }] } for `owner` (`names(id)` is how an owner is called; the main character's is `party`).
 */
export function slotCarriers({ owner, stacks, defs, mounts, place, names, carryOf }) {
    const who = fold(names(owner) || owner);
    const rows = (Array.isArray(mounts) ? mounts : []).filter(row => row && typeof row.name === 'string').map(row => ({
        name: row.name, kind: String(row.kind ?? ''), pace: whole(row.pace, 0), count: whole(row.count, 1),
        carry: whole(row.carry, kindCarry(row.kind)) * whole(row.count, 1), riders: ridersOf(row.where), withParty: travelsWith(row.where, place), where: String(row.where ?? '').trim(),
    }));
    const ridden = rows.find(row => row.riders.some(name => fold(name) === who)) ?? null;
    const packs = stacks.filter(stack => bagLike(defs[stack.def], carryOf(defs[stack.def]) ?? 0)).map(stack => ({
        stack: stack.id, name: defs[stack.def].name, carry: carryOf(defs[stack.def]) ?? 0, owner: stack.owner, by: names(stack.owner) || stack.owner,
        bag: stack.equipped === BAG_PLACE, bound: typeof stack.bound === 'string' && stack.bound ? names(stack.bound) || stack.bound : '',
    }));
    const own = packs.find(pack => pack.owner === owner && pack.bag) ?? null;
    return {
        ride: ridden ? { name: ridden.name, kind: ridden.kind, pace: ridden.pace, carry: ridden.carry } : null,
        bag: own ? { stack: own.stack, name: own.name, carry: own.carry } : null, mounts: rows, packs,
    };
}
