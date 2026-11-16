// Remaking a piece as equipment, where an accessory goes, and moving a piece's stat points.

import { gearSlotOf, handDef, gearBudget } from '../../gear.js';
import { fill } from '../../../../../../../core/strings.js';
import { gearOn } from '../state.js';
import { baseSlot } from '../validate.js';
import { E, refuseBound, boundId } from '../stacks.js';
import { kitOpen, handStats } from './kit.js';

/**
 * "+ Add item" with Kind = Equipment names a definition that already exists and is not equipment (or is the reader's own equipment with no slot): the
 * reader's choice wins and the definition is made equipment in this same add (its own recorded op, so a replay does the same), only when nobody but
 * the reader has a claim on it:
 *  - never a pack's definition (`pack.…`), a bound piece's, or anything with a stack the story gave (`story: true`);
 *  - a definition marked `hand` (made by a reader's add): also while the reader's own stacks of it are held (each of one, as equipment does not stack);
 *  - any other `story/` definition (older saves did not mark the reader's): only while no stack of it is left, as when the reader has deleted it.
 * Anything else is refused with a sentence that says what to do.
 */
export function remakeAsEquipment(ctx, inv, def, keep, slot) {
    const fixable = def.kind !== 'equipment' || (!def.slot && Boolean(slot));
    if (!fixable) return;
    const stacks = Object.values(inv.stacks).filter(stack => stack.def === def.id);
    const theirs = def.id.startsWith('story/') && !stacks.some(stack => stack.story === true || stack.bound !== undefined)
        && (def.hand === true ? stacks.every(stack => stack.qty === 1) : stacks.length === 0);
    if (!theirs) ctx.fail('REFUSED', fill(E.kitExisting, { name: def.name, kind: def.kind }));
    const place = keep.slot ?? def.slot ?? gearSlotOf(null, def.name);
    Object.assign(inv.defs[def.id], { kind: 'equipment', stack: false, slot: place ?? null, stats: keep.stats ?? {}, hand: true });
    def.kind = 'equipment'; def.stack = false; def.slot = place ?? null; def.stats = keep.stats ?? {};
}

// Where a piece of `slot` goes on `owner`: an accessory takes the place named when it is free, else the other one when that is free
// (a second accessory goes to Accessory 2), else the place named. Other slots are their own place.
export function handPlace(inv, owner, stackId, slot) {
    if (baseSlot(slot) !== 'accessory') return slot;
    const free = key => !Object.values(inv.stacks).some(other => other.owner === owner && other.id !== stackId && other.equipped === key);
    const named = slot === 'accessory' ? 'accessory-1' : slot;
    return [named, ...['accessory-1', 'accessory-2'].filter(key => key !== named)].find(free) ?? named;
}

/**
 * Does this `inventory.edit` only move the stat points of a piece that is no longer the reader's to remake (the story's, a pack's, or their own after the
 * starting kit)? Then `repoint` does it; a hand-made piece while the kit is open goes through `handEdit` (its def's stats).
 */
export const wantsRepoint = (env, inv, stack, payload) => payload.stats !== undefined && payload.kind === undefined && payload.slot === undefined && payload.rarity === undefined
    && (!handDef(inv, inv.defs[stack.def]) || !kitOpen(env));

/**
 * The reader moves the points of any gear piece they hold (`stats`: { AGI: 1, DEX: 1 }): the same total (its rarity's budget or a pack's bonus) on at most
 * GEAR.maxStats stats. Rarity and the total never change. The choice is kept on each piece of that item the reader owns (`stack.stats`), not on the def, so a
 * pack's definition stays as it is and a replay lands the same. A bound piece stays as the cast member has it (refused).
 */
export function repoint(ctx, inv, stack, payload) {
    if (!gearOn(ctx)) ctx.fail('REFUSED', E.gearOff);
    const def = inv.defs[stack.def];
    refuseBound(ctx, inv, stack);
    if (def.kind !== 'equipment' || !def.slot) ctx.fail('INVALID', E.gearNeedsEquipment);
    const budget = gearBudget(def);
    if (budget <= 0) ctx.fail('REFUSED', E.repointNone);
    const stats = handStats(ctx, payload.stats);
    const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
    if (total !== budget) ctx.fail('REFUSED', fill(E.repointTotal, { max: budget, points: budget === 1 ? 'point' : 'points', total }));
    for (const piece of Object.values(inv.stacks)) {
        if (piece.def !== def.id || piece.owner !== stack.owner || boundId(ctx, piece)) continue;
        piece.stats = { ...stats };
    }
}
