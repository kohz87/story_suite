// Reads a foe's group, number and bar value, and builds a virtual bar's slot (group 3, pack 2 is 32).

import { num } from './shared-numbers.js';

const realSlot = foe => num(foe?.slot) >= 1 && num(foe?.slot) <= 6;
export const groupOf = foe => (Number.isInteger(foe?.group) ? num(foe.group) : realSlot(foe) ? num(foe.slot) : Math.floor(num(foe?.slot) / 10));
export const nOf = foe => (Number.isFinite(foe?.n) ? num(foe.n) : realSlot(foe) ? 1 : num(foe?.slot) % 10);
export const valueOf = foe => (Number.isFinite(foe?.value) ? foe.value : foe?.hurt);

/** A virtual bar's slot: group 3, pack 2 is 32. Virtual slots are never a real slot 1..6. */
export const virtualSlot = (group, n) => num(group) * 10 + num(n);
