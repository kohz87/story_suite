// The soak one worn piece gives: its rarity's points in a protecting slot while it is Good or Worn; torn and broken pieces give none.

import { GEAR } from './constants.js';
import { gearBudget } from './budget.js';

const baseOf = slot => (typeof slot === 'string' ? slot.trim().replace(/-\d+$/, '') : '');

/** Soak points of a piece of `def` in condition `cond` (0…100; missing = new): the def's budget in body, off-hand, head, cloak, feet or accessory; 0 for a weapon, a bag, a torn or broken piece. */
export function soakFor(def, cond = 100) {
    if (!def || def.kind !== 'equipment' || !GEAR.soak.slots.includes(baseOf(def.slot))) return 0;
    if (Number.isFinite(cond) && cond < GEAR.soak.minCond) return 0;
    return gearBudget(def);
}
