// The Bag Edit's load weight and soak for any unbound piece (a pack's, the story's or the reader's own): set on its definition.

import { GEAR, soakCap, placeOf, slotWordOf } from '../gear.js';
import { fill } from '../../../core/strings.js';
import { gearOn } from '../state.js';
import { E, refuseBound } from '../stacks.js';

/**
 * `inventory.edit { stack, weight?, soak? }` (gear on): `weight` is what one unit weighs in load (0 to GEAR.weight.max; never for coins), `soak` what the piece
 * soaks worn (0 up to its slot's cap; only equipment with a slot that protects). Both go on the piece's definition, so every piece of that item changes with it, and
 * both are the reader's alone: a story line or a pack's later copy never raises them. Any time, not only while the starting kit is open. A bound piece stays as the cast
 * member has it (refused). A soak above the cap is refused with the cap, not lowered quietly.
 */
export function numberEdit(ctx, inv, stack, payload) {
    if (!gearOn(ctx)) ctx.fail('REFUSED', E.gearOff);
    refuseBound(ctx, inv, stack);
    const def = inv.defs[stack.def];
    const { weight, soak } = payload;
    if (weight !== undefined) {
        if (def.kind === 'money') ctx.fail('INVALID', E.weightMoney);
        if (!(Number.isSafeInteger(weight) && weight >= 0 && weight <= GEAR.weight.max)) ctx.fail('INVALID', fill(E.handWeight, { max: GEAR.weight.max }));
    }
    if (soak !== undefined) {
        if (!(Number.isSafeInteger(soak) && soak >= 0)) ctx.fail('INVALID', E.handSoak);
        const max = def.kind === 'equipment' ? soakCap(def.slot) : 0;
        if (soak > max) ctx.fail('INVALID', fill(E.soakOver, { name: def.name, max, slot: def.kind === 'equipment' && slotWordOf(def.slot) ? placeOf(slotWordOf(def.slot)) : 'no slot' }));
        if (soak > 0) def.soak = soak;
        else delete def.soak;
    }
    if (weight !== undefined) def.weight = weight;
}
