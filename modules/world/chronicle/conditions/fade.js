// Reading how long a condition lasts: "10 days", "1 season", "until cleared" (spec §2 Time units). A condition timer is whole days,
// rounded up, at least 1 day, times the world's tempo (0.25-4, spec §2 Time units: fades are scaled); a season is 90 × tempo days (the
// daily step's reading, daily/durations.js). A shorter text the time part reads ("3 hours") is raised to 1 day. Pure.

import { durationMinutes } from '../../../time/tracker/time.js';
import { durationDays, scaleDays } from '../../daily/durations.js';

const DAY = 1440;
const UNTIL = /^(?:until cleared|never|null)$/i;

/**
 * `fadeMinutes(text, tempo = 1)`: the minutes a condition lasts (whole days, at least one) at `tempo` (a number outside 0.25-4 is 1),
 * `null` for "until cleared" (or null), `undefined` when the text is not a duration.
 */
export function fadeMinutes(text, tempo = 1) {
    const paced = Number.isFinite(tempo) && tempo >= 0.25 && tempo <= 4 ? tempo : 1;
    if (text === null) return null;
    if (typeof text !== 'string' || !text.trim()) return undefined;
    if (UNTIL.test(text.trim())) return null;
    const days = durationDays(text.trim());
    if (typeof days === 'number') return scaleDays(days, paced) * DAY;
    const minutes = durationMinutes(text);
    return Number.isFinite(minutes) && minutes > 0 ? scaleDays(minutes / DAY, paced) * DAY : undefined;
}
