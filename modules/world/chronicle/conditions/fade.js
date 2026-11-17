// Reading how long a condition lasts: "10 days", "1 season", "until cleared" (spec §2 Time units). A condition timer is whole days,
// rounded up, at least 1 day; a season is 90 days (the daily step's reading, daily/durations.js, at tempo 1: the host has no tempo
// setting). A shorter text the time part reads ("3 hours") is raised to 1 day. Pure.

import { durationMinutes } from '../../../time/tracker/time.js';
import { durationDays, scaleDays } from '../../daily/durations.js';

const DAY = 1440;
const UNTIL = /^(?:until cleared|never|null)$/i;

/**
 * `fadeMinutes(text)`: the minutes a condition lasts (whole days, at least one), `null` for "until cleared" (or null),
 * `undefined` when the text is not a duration.
 */
export function fadeMinutes(text) {
    if (text === null) return null;
    if (typeof text !== 'string' || !text.trim()) return undefined;
    if (UNTIL.test(text.trim())) return null;
    const days = durationDays(text.trim());
    if (typeof days === 'number') return scaleDays(days) * DAY;
    const minutes = durationMinutes(text);
    return Number.isFinite(minutes) && minutes > 0 ? scaleDays(minutes / DAY) * DAY : undefined;
}
