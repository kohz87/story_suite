// Rolls a reply's three d20 from its seed and re-exports the note line.

import { rng } from '../../../../core/commands/rng.js';
import { offerLine } from '../../cue.js';
import { FORMULA } from '../../names.js';

/** How many dice one reply offers. */
export const CHECK_DICE_COUNT = 3;

/** The reply's dice, in order, from its uint32 seed: three whole numbers from 1 to 20. */
export function replyDice(seed) {
    const random = rng(seed);
    return Array.from({ length: CHECK_DICE_COUNT }, () => 1 + Math.floor(random() * FORMULA.die));
}

export { offerLine };
