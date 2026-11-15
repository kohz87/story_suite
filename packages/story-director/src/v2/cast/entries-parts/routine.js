// Story Director v2, part **cast**: parsing routine time-of-day phrases and checking whether a routine holds.

import { DAY, isInt } from '../domain.js';

// The hours (from, to; a range may wrap midnight) each word of the day stands for. A routine that names none holds at any hour.
const PARTS = [
    [/\b(?:dawn|sunrise|daybreak|first light)\b/i, 4, 8],
    [/\b(?:morning|mornings|forenoon)\b/i, 6, 12],
    [/\b(?:noon|midday|lunchtime)\b/i, 11, 14],
    [/\b(?:afternoon|afternoons)\b/i, 12, 18],
    [/\b(?:dusk|sunset|twilight)\b/i, 17, 21],
    [/\b(?:evening|evenings|nightfall)\b/i, 17, 23],
    [/\b(?:night|nights|nightly|midnight|overnight|after dark)\b/i, 20, 5],
    [/\b(?:daytime|by day|during the day|day shift)\b/i, 6, 18],
];
const inRange = (hour, from, to) => (from <= to ? hour >= from && hour < to : hour >= from || hour < to);

/** The routine's hours: a list of [from, to] pairs, or null when it names no time of day. */
export function routineHours(routine) {
    const hours = PARTS.filter(([pattern]) => pattern.test(String(routine ?? ''))).map(([, from, to]) => [from, to]);
    return hours.length ? hours : null;
}

/**
 * Whether the routine has someone at their place at story minute `now`: true when it names no time of day, or the clock is not
 * set (nothing can be said against it), else when the hour is inside one of its ranges.
 */
export function routineHolds(routine, now) {
    const hours = routineHours(routine);
    if (!hours || !isInt(now)) return true;
    const hour = Math.floor((((now % DAY) + DAY) % DAY) / 60);
    return hours.some(([from, to]) => inRange(hour, from, to));
}
