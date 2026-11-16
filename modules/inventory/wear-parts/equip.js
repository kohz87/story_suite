// Equips a stack into a slot for its owner (`item.equip`).

import { ownerNameIn } from '../../scene/domains/common.js';
import { slotWordOf, GEAR, placeOf } from '../gear.js';
import { gearOn } from '../state.js';
import { baseSlot } from '../validate.js';
import { stackIn, refuseBound } from '../stacks.js';

// `item.equip { stack, owner?, slot }` (`story-block.gear`): one item per slot per owner. The reader's Edit and the gear UI use it; the item
// must be equipment that fits the slot (its own slot, or an accessory in either accessory place), and belong to `owner`.
export function itemEquip(ctx, payload) {
    if (!gearOn(ctx)) ctx.fail('REFUSED', 'Gear is not switched on.');
    let inv = ctx.draft('inventory');
    let stack = stackIn(ctx, inv, payload.stack);
    const def = inv.defs[stack.def];
    // (a bound piece is not handed to anyone else, and, once worn, not moved to another slot: inventory.equip says so for the slot)
    if (payload.owner !== undefined && payload.owner !== stack.owner) refuseBound(ctx, inv, stack);
    // `transfer: true` (the item Edit): hand it to `owner` first. It is one command, so a refusal below leaves it where it was (all or nothing).
    let handed = false;
    if (payload.owner !== undefined && payload.owner !== stack.owner && payload.transfer === true) {
        const moved = ctx.call('inventory.transfer', { stack: stack.id, to: payload.owner });
        inv = ctx.draft('inventory');
        stack = stackIn(ctx, inv, moved?.data?.stack ?? stack.id);
        handed = true;
    }
    if (payload.owner !== undefined && payload.owner !== stack.owner) ctx.fail('REFUSED', `${def.name} is not ${ownerNameIn(ctx, payload.owner)}'s.`);
    const named = slotWordOf(payload.slot ?? def.slot);
    if (!named) ctx.fail('INVALID', `The slot is one of ${GEAR.places.join(', ')}.`);
    const own = slotWordOf(def.slot);
    if (def.kind === 'equipment' && own && baseSlot(named) !== baseSlot(own) && !(own === 'accessory' && baseSlot(named) === 'accessory')) ctx.fail('REFUSED', `${def.name} does not fit the ${named} slot.`);
    const place = placeOf(named);
    // Accessories: either place, the first free one when none was named.
    let where = place;
    if (named === 'accessory') {
        const taken = key => Object.values(inv.stacks).some(other => other.owner === stack.owner && other.id !== stack.id && other.equipped === key);
        where = ['accessory-1', 'accessory-2'].find(key => !taken(key)) ?? 'accessory-1';
    }
    const out = ctx.call('inventory.equip', { stack: stack.id, slot: where });
    return { ...out, data: { ...(out.data ?? {}), owner: stack.owner, place: where, ...(handed ? { handed: true } : {}) } };
}
