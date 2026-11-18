// Story-minute and story-day text: a story minute or day written as the dossier writes a date.
import { GREGORIAN_DAYS, STORY_DAY_MINUTES, storyClockParts } from './shared-minutes.js';
import { readStoryClock, storyClockSource } from './clock-source.js';

const GREGORIAN_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A story minute as the dossier writes a date: "Goldwane 18" (month and day, no year, no clock) on `calendar`
 * (`{ months: [{ name, days }], leapYears }`, Story Director's `director.calendar`), Gregorian when it is not given
 * ('' for anything that is not a story minute). Story Director's key people carry their dates as minutes.
 */
export function storyMinuteText(minutes, calendar = null) {
    const shared = calendar && Array.isArray(calendar.months) && calendar.months.length
        ? calendar
        : { months: GREGORIAN_MONTH_NAMES.map((name, at) => ({ name, days: GREGORIAN_DAYS[at] })), leapYears: true };
    const parts = storyClockParts(minutes, shared);
    const name = parts ? String(shared.months[parts.monthIndex]?.name ?? '').trim() : '';
    return name ? `${name} ${parts.day}` : '';
}

/**
 * A whole story day number (minutes / 1440, as notes store it) as the dossier writes a date ("Goldwane 12") on the Story Director calendar,
 * or '' when no host clock or calendar is known (the caller then says nothing or "when first seen"; the raw counter is never shown).
 */
export function storyDayText(day) {
    if (!storyClockSource || !Number.isSafeInteger(day) || day < 0) return '';
    let clock = null;
    try { clock = readStoryClock(); } catch { return ''; }
    return Array.isArray(clock?.calendar?.months) ? storyMinuteText(day * STORY_DAY_MINUTES, clock.calendar) : '';
}
