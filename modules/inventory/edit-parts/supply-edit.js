// The reader's Edit that marks an item as a supply, or takes the mark off: the kind alone, on any item but equipment and money.

import { fill } from '../../../core/strings.js';
import { E, refuseBound, boundId } from '../stacks.js';

const FIXED = Object.freeze(['equipment', 'money']);

/**
 * `inventory.edit { stack, kind }`, with Gear on or off, on the story's and a pack's items too: to `supply`, keeping the kind it had (`wasKind`), or from
 * `supply` back to that kind only (goods for one that never had another). It goes on the definition, so every piece of that item changes (refused when any is
 * a cast member's). True when it was this edit; any other payload is left to the gear Edit and its rules.
 */
export function supplyEdit(ctx, inv, stack, payload) {
    const def = inv.defs[stack.def];
    if (['slot', 'rarity', 'stats'].some(key => payload[key] !== undefined) || FIXED.includes(def.kind) || FIXED.includes(payload.kind)) return false;
    const marking = payload.kind === 'supply';
    if (!marking && !(def.kind === 'supply' && payload.kind === (def.wasKind ?? 'goods'))) return false;
    for (const item of Object.values(inv.stacks)) if (item.def === def.id && boundId(ctx, item)) refuseBound(ctx, inv, item);
    if (!marking) delete def.wasKind;
    else if (def.kind !== 'supply') def.wasKind = def.kind;
    def.kind = payload.kind;
    return true;
}
