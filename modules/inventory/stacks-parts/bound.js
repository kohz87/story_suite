// The bound-gear guards: who a stack is bound to and refusing or skipping bound stacks.

import { ownerNameIn } from '../../scene/domains/common.js';
import { fill } from '../../../core/strings.js';
import { gearOn } from '../state.js';
import { E } from './common-ctx.js';

/** The member a stack is bound to, or null (not bound, or the gear switch is off). */
export const boundId = (ctx, stack) => (typeof stack?.bound === 'string' && stack.bound && gearOn(ctx) ? stack.bound : null);

// (the name by the party module's roster, else the party domain, else the ID)
export function boundName(ctx, id) {
    try {
        const actors = ctx.query('party.actors');
        const found = (Array.isArray(actors) ? actors : []).find(entry => entry?.id === id && typeof entry.name === 'string' && entry.name.trim());
        if (found) return found.name.trim();
    } catch { /* no roster: the party domain's name */ }
    return ownerNameIn(ctx, id);
}

/** Refuses (REFUSED, "Bound to Mara: Cane Sword stays with them.") when `stack` is bound; nothing otherwise. */
export function refuseBound(ctx, inv, stack) {
    const id = boundId(ctx, stack);
    if (id) ctx.fail('REFUSED', fill(E.bound, { name: boundName(ctx, id), item: inv.defs[stack.def]?.name ?? 'That piece' }));
}

/** `stacks` without the bound ones; refuses when it held some and every one of them is bound. */
export function unbound(ctx, inv, stacks) {
    const free = stacks.filter(stack => !boundId(ctx, stack));
    if (stacks.length && !free.length) refuseBound(ctx, inv, stacks[0]);
    return free;
}
