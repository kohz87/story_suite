// What one unit of an item weighs in load: its own `weight` (a pack's, or the reader's Edit), else a default by slot or kind. Coins weigh nothing.

import { GEAR } from './constants.js';

const baseOf = slot => (typeof slot === 'string' ? slot.trim().replace(/-\d+$/, '') : '');
const whole = value => Number.isSafeInteger(value) && value >= 0 && value <= GEAR.weight.max;

/** A pack item's explicit `weight` (a whole number 0…GEAR.weight.max), only for a `pack.` def; else null (a story line never sets one). */
export const packWeight = (id, value) => (typeof id === 'string' && id.startsWith('pack.') && whole(value) ? value : null);

/** The default weight of an item with no `weight` of its own: equipment by its slot (weapon 3, body 5, off-hand 4, head 2, cloak 2, feet 2, accessory 0), a quest item 0, anything else 1. */
export function defaultWeight(def) {
    if (def?.kind === 'equipment') return GEAR.weight.bySlot[baseOf(def.slot)] ?? GEAR.weight.other;
    return GEAR.weight.byKind[def?.kind] ?? GEAR.weight.other;
}

/** What one unit of `def` weighs: 0 for money; else its own `weight`, else its default. */
export function weightFor(def) {
    if (def?.kind === 'money') return 0;
    return whole(def?.weight) ? def.weight : defaultWeight(def);
}
