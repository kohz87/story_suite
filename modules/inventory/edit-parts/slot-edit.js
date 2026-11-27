// The reader's choice of slot: fitting a piece's definition to a new slot, and the slot-only Edit of gear the story or a pack gave.

import { soakCap, statsOf, statsFor } from '../gear.js';
import { BAG_PLACE } from '../state.js';
import { baseSlot } from '../validate.js';
import { refuseBound, boundId } from '../stacks.js';
import { handSlot } from './kit.js';

/**
 * Puts `def` (of `kind`) in `slot` (a place word, or null for none). A piece that no longer fits where it is worn is taken off (a carried bag stays
 * the bag unless it now has a slot of its own), and the soak the piece had is held to the new slot's cap: none off equipment or without a slot.
 */
export function fitSlot(def, pieces, kind, slot) {
    for (const item of pieces) {
        const off = item.equipped === BAG_PLACE ? kind === 'equipment' && Boolean(slot) : kind !== 'equipment' || !slot || baseSlot(item.equipped) !== baseSlot(slot);
        if (item.equipped !== null && off) item.equipped = null;
    }
    def.slot = slot ? baseSlot(slot) : null;
    const soak = kind !== 'equipment' || !slot ? 0 : Math.min(def.soak ?? 0, soakCap(slot));
    if (soak > 0) def.soak = soak;
    else delete def.soak;
}

// A definition that lists no stats takes its bonus from its name or slot: write down what it gives now (`noBonus` for none), so the new slot cannot change it.
function keepBonus(def) {
    if (def.noBonus === true || Object.keys(statsOf(def.stats)).length) return;
    const given = statsFor(def);
    if (Object.keys(given).length) def.stats = given;
    else def.noBonus = true;
}

/**
 * `inventory.edit { stack, slot }` on equipment that is not the reader's to remake (the story's or a pack's): the slot only ('' for none). Rarity, stats
 * and kind stay as given. It goes on the definition, as the Edit's weight does, so every piece of that item changes: refused when any of them is a cast member's (one set aside while they are away too).
 */
export function slotEdit(ctx, inv, def, payload) {
    const pieces = Object.values(inv.stacks).filter(item => item.def === def.id);
    for (const item of pieces) if (boundId(ctx, item)) refuseBound(ctx, inv, item);
    // (and a piece set aside for a member who is away: it is worn again in its old place when they come back)
    for (const [owner, list] of Object.entries(inv.kept && typeof inv.kept === 'object' ? inv.kept : {})) if (Array.isArray(list) && list.some(entry => entry?.def === def.id)) refuseBound(ctx, inv, { def: def.id, bound: owner });
    const slot = handSlot(ctx, payload.slot);
    if ((slot ? baseSlot(slot) : null) !== (def.slot ? baseSlot(def.slot) : null)) keepBonus(def);
    fitSlot(def, pieces, def.kind, slot);
}
