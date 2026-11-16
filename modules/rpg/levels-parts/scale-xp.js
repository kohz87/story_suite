// Levels: scaling an XP gain by the rate.

import { XP_RATE, xpRateOf } from './xp-rate.js';

/** An XP gain at `rate` per cent: floor(gain × rate / 100), at least 1 when the gain was 1 or more; a gain below 1 (or damaged) is 0. A missing rate is 100. */
export function scaleXp(gain, rate = XP_RATE.default) {
    if (!Number.isSafeInteger(gain) || gain < 1) return Number.isSafeInteger(gain) ? gain : 0;
    const used = xpRateOf(rate) ?? XP_RATE.default;
    return Math.max(1, Math.floor(gain * used / 100));
}
