// Hero editor: reading the header's clock and telling whether the clock fields are there.

import { short } from './shared-limits.js';

// The clock as the header gives it: `{ parts: { year, month, day, minutes } | null, era, months: [{ name, days }] }`, else null (no clock fields).
export function clockOf(clock) {
    if (!clock || typeof clock !== 'object' || !Array.isArray(clock.months) || !clock.months.length) return null;
    const parts = clock.parts && typeof clock.parts === 'object' ? clock.parts : null;
    return { parts, era: short(clock.era, 20), months: clock.months };
}

/** Whether the hero's clock fields are there for these props. */
export const hasClock = p => clockOf(p?.clock) !== null;
