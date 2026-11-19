// Which items a party member can carry as their bag (the Party paper-doll's Bag slot): a carrying item (its `carry` adds
// load), or an item without a slot whose name says it is a bag ("Leather Satchel"); a piece worn in a slot of its own is not one.

import { slotWordOf } from '../stats-parts/slots.js';

const BAG_NOUN = /\b(?:bag|pack|backpack|satchel|sack|pouch|haversack|knapsack|rucksack|quiver)s?\b/i;

/** Can `def` be carried as a bag? `carry` is what it adds (the inventory's defCarry, 0 for none). */
export const bagLike = (def, carry) => def?.kind !== 'money' && !(def?.kind === 'equipment' && slotWordOf(def.slot)) && (carry > 0 || BAG_NOUN.test(String(def?.name ?? '')));

/** Why `def` is not a bag ('' when it is one). */
export function notABag(def, carry) {
    if (bagLike(def, carry)) return '';
    if (def?.kind === 'equipment' && slotWordOf(def.slot)) return `${def.name} is worn in a slot of its own (${slotWordOf(def.slot)}).`;
    return `${def?.name ?? 'That'} is not a bag: it adds no load.`;
}
