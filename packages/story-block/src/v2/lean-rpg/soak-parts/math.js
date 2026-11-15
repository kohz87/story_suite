// The soak maths: S for a VIT, whether a hit glances off, and the Party card's numbers.
import { SOAK_BASE, SOAK_MAX, SOAK_STEP } from './constants.js';

/** S for an effective VIT (0 when it is not a number). */
export const soakOf = vit => (Number.isFinite(vit) ? Math.min(SOAK_MAX, Math.max(0, Math.floor(vit / SOAK_STEP))) : 0);

/** Whether a foe's non-decisive hit, `margin` ahead of the defender, glances off at soak `s`. */
export const soaked = (s, margin, decisive) => s >= 0 && !decisive && margin <= SOAK_BASE + s;

/** The Party card's numbers for an effective VIT: { s, next } (`next`: the VIT that adds one, null at the top). */
export function soakGrowth(vit) {
    const s = soakOf(vit);
    return { s, next: s >= SOAK_MAX ? null : (s + 1) * SOAK_STEP };
}
