// Rolls a text RPG reply's three d20 from its seed.
// Adapted from modules/rpg/checks/dice-parts/roll.js (keep in step when that file changes).

import { rng } from './rng.js';

/** How many dice one reply offers. */
export const DICE_COUNT = 3;

/** The reply's dice, in order, from its uint32 seed: three whole numbers from 1 to 20. */
export function replyDice(seed) {
    const random = rng(seed);
    return Array.from({ length: DICE_COUNT }, () => 1 + Math.floor(random() * 20));
}
