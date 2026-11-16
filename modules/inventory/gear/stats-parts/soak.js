// The soak one worn piece gives: its own value (its definition's `soak`), held to its slot's cap, while it is Good or Worn; torn and broken pieces give none.

import { GEAR } from './constants.js';

const baseOf = slot => (typeof slot === 'string' ? slot.trim().replace(/-\d+$/, '') : '');

/** The most soak a piece in `slot` (or a place such as accessory-2) may give: body 2, off-hand 2, head 1, the rest 0. */
export const soakCap = slot => GEAR.soak.caps[baseOf(slot)] ?? 0;

/** A pack item's explicit `soak` (a whole number inside its slot's cap, 0…2), only for a `pack.` def; else null. */
export const packSoak = (id, value) => (typeof id === 'string' && id.startsWith('pack.') && Number.isSafeInteger(value) && value >= 0 && value <= GEAR.soak.capMax ? value : null);

/**
 * Soak of a piece of `def` in condition `cond` (0…100; missing = new) worn at `place` (default: the def's own slot): the def's `soak` (default 0) held to the
 * place's cap; 0 for a weapon, a bag, a torn or broken piece. Rarity never sets it.
 */
export function soakFor(def, cond = 100, place = def?.slot) {
    if (!def || def.kind !== 'equipment' || !Number.isSafeInteger(def.soak) || def.soak <= 0) return 0;
    if (Number.isFinite(cond) && cond < GEAR.soak.minCond) return 0;
    return Math.min(def.soak, soakCap(place));
}
