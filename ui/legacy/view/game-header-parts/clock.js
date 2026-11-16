// The editor's clock props from Story Director's time and calendar.

import { count, textOf } from './shared-reads.js';

const wholeIn = (value, min, max) => (Number.isSafeInteger(value) && value >= min && value <= max ? value : null);

/**
 * The editor's clock: `{ parts: { year, month, day, minutes } | null, era, months: [{ name, days }] }`, or null (the editor then has no date and
 * time fields): Story Director must answer its time with a `parts` key (an object, or null while the clock is unset) and its calendar with months.
 */
export function clockProps(time, calendar) {
    if (!time || typeof time !== 'object' || !('parts' in time)) return null;
    const months = (Array.isArray(calendar?.months) ? calendar.months : [])
        .map(month => ({ name: textOf(month?.name).slice(0, 40), days: count(month?.days) }))
        .filter(month => month.name && Number.isSafeInteger(month.days) && month.days >= 1)
        .slice(0, 60);
    if (!months.length) return null;
    const raw = time.parts && typeof time.parts === 'object' ? time.parts : null;
    const parts = raw && Number.isSafeInteger(raw.year) && wholeIn(raw.month, 1, months.length) !== null && wholeIn(raw.day, 1, 1e4) !== null && wholeIn(raw.minutes, 0, 1439) !== null
        ? { year: raw.year, month: raw.month, day: raw.day, minutes: raw.minutes }
        : null;
    return { parts, era: textOf(calendar?.era).slice(0, 20), months };
}
