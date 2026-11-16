// Adding stacks: a new stack, a loose stack to join and putting a quantity with an owner.

import { newId } from '../../scene/domains/common.js';
import { MAX_UNSTACKED, COND_MAX, condOf } from '../state.js';
import { byId } from './shared-order.js';

// A key item (`key: true` on its stack): a stack kept apart from the rest of that item (an older chat's
// notable gift from the story, which the story no longer needs). It is used, worn, given and consumed like any other, but it has no cash value: a module
// that buys things back or counts what they are worth (for trade or crafting) counts it as 0.
// It never joins another stack, nor another stack it (looseMatch, inventory.merge), and the part of it
// that is given away or split off stays a key stack.
// The story's own (`story: true` on its stack, B-a2-2): what a story line (`+ item`) gave, or the reader
// took from a story's loot (`? loot`, inventory.lootTake, FB-2), whatever its def (a pack's item named in
// the story too). inventory.grant never sets it: no story line reaches it (modules and pack events call it
// with what their code chose) and it moves no stack. A
// module that buys things back holds what it pays for it to its worth at the sell rate (the module's
// trade). It stacks with the rest of that item; a stack it joins, or that joins it, is the story's too,
// and the part of it that is given away or split off stays the story's.
// A new stack's id. Under the `itemIds` rule mark (a reply's first live capture) it comes from the receipt's id stream, which no other
// roll touches, so a Re-read that adds a line before this one (it may define the item, which skips this line's rolls) keeps the id the
// reader's later edits point at. An older reply keeps drawing from the main stream (its stored ids replay as before).
function newStackId(ctx, inv) {
    const taken = id => Boolean(inv.stacks[id]);
    if (!(Array.isArray(ctx.carrier?.rules) && ctx.carrier.rules.includes('itemIds') && typeof ctx.id === 'function')) return newId(ctx, 'it', taken);
    for (let attempt = 0; attempt < 64; attempt += 1) {
        const id = ctx.id('it');
        if (!taken(id)) return id;
    }
    return ctx.fail('FAILED', 'No free ID could be found for a new record.');
}

export function addStack(ctx, inv, def, qty, owner, note, key = false, story = false) {
    const id = newStackId(ctx, inv);
    inv.stacks[id] = { id, def, qty, owner, equipped: null, note, from: typeof ctx.receiptId === 'string' ? ctx.receiptId : '', ...(key ? { key: true } : {}), ...(story ? { story: true } : {}) };
    return id;
}

// A loose stack to add to: the same def, owner and note, not worn, in the same condition (`cond`).
export function looseMatch(inv, def, owner, note, except = null, cond = COND_MAX) {
    return Object.values(inv.stacks).sort(byId)
        .find(stack => stack.id !== except && stack.def === def && stack.owner === owner && stack.equipped === null && stack.note === note && condOf(stack, inv) === cond && stack.key !== true && stack.bound === undefined) ?? null;
}

/**
 * Puts `qty` of a def with an owner: onto a matching loose stack when it stacks, else new stacks (a key
 * item always its own). `story`: a story line gave it (addStack), and a stack it joins is the story's.
 */
export function grantInto(ctx, inv, def, qty, owner, note, key = false, story = false) {
    if (key) {
        if (def.stack) return [addStack(ctx, inv, def.id, qty, owner, note, true, story)];
        if (qty > MAX_UNSTACKED) ctx.fail('INVALID', `${def.name} does not stack; at most ${MAX_UNSTACKED} can be given at once.`);
        return Array.from({ length: qty }, () => addStack(ctx, inv, def.id, 1, owner, note, true, story));
    }
    if (def.stack) {
        const same = looseMatch(inv, def.id, owner, note);
        if (same) {
            same.qty += qty;
            if (story) same.story = true;
            return [same.id];
        }
        return [addStack(ctx, inv, def.id, qty, owner, note, false, story)];
    }
    if (qty > MAX_UNSTACKED) ctx.fail('INVALID', `${def.name} does not stack; at most ${MAX_UNSTACKED} can be given at once.`);
    return Array.from({ length: qty }, () => addStack(ctx, inv, def.id, 1, owner, note, false, story));
}
