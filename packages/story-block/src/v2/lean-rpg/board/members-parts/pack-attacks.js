// Counts a pack's attacks each exchange: full strength, and thinning with its bar.

import { PACK_MAX_ATTACKS, PACK_MAX_ATTACKS_SIX } from './pack-limits.js';
import { clamp, num } from './shared-numbers.js';

/** How many attacks a full pack makes each exchange: 1 + floor(count / 2), at most 6 under the six-group rule (`six`); else 1 + floor(count / 6), at most 3 (a twelve-foe pack makes three). */
export const packFullAttacks = (count, six = false) => (six === true
    ? Math.min(PACK_MAX_ATTACKS_SIX, 1 + Math.floor(Math.max(0, num(count)) / 2))
    : Math.min(PACK_MAX_ATTACKS, 1 + Math.floor(Math.max(0, num(count)) / 6)));

/** A pack's attacks now, thinning with its bar; 0 when it is Down. `full` is the pack's full attacks (a split pack carries it as `full`); absent = the old rule. */
export function packAttacks(count, value, size, full = packFullAttacks(count)) {
    if (num(value) <= 0) return 0;
    return clamp(Math.ceil(full * num(value) / Math.max(1, num(size))), 1, full);
}
