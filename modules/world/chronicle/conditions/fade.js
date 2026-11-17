// Reading how long a condition lasts: "10 days", "1 season", "until cleared". Pure.

import { durationMinutes } from '../../../time/tracker/time.js';

const DAY = 1440;
// The words a duration may use besides the time part's (a month is 30 days, a season 90, a year 360: the calendar is not asked).
const BIG = [[/^(?:months?)$/i, 30 * DAY], [/^(?:seasons?)$/i, 90 * DAY], [/^(?:years?)$/i, 360 * DAY]];
const UNTIL = /^(?:until cleared|never|null)$/i;

/**
 * `fadeMinutes(text)`: the minutes a condition lasts (a whole number above 0), `null` for "until cleared" (or null),
 * `undefined` when the text is not a duration.
 */
export function fadeMinutes(text) {
    if (text === null) return null;
    if (typeof text !== 'string' || !text.trim()) return undefined;
    if (UNTIL.test(text.trim())) return null;
    const big = text.trim().match(/^(\d+(?:\.\d+)?|an?)\s*([a-z]+)$/i);
    const unit = big && BIG.find(([pattern]) => pattern.test(big[2]));
    if (unit) {
        const minutes = Math.round((/^an?$/i.test(big[1]) ? 1 : Number(big[1])) * unit[1]);
        return minutes > 0 ? minutes : undefined;
    }
    return durationMinutes(text) ?? undefined;
}
