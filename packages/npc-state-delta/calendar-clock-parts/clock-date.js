// The hosted story date: Story Director's clock on Delta's calendar, with the manual-clock fallback.
import { getActiveCalendarConfig, normalizeCalendarConfig, normalizeMonthKey } from '../calendar-config.js';
import { currentCalendarDate, normalizeCalendarDate } from '../calendar-date.js';
import { GREGORIAN_DAYS, storyClockParts } from './shared-minutes.js';
import { readStoryClock, storyClockSource } from './clock-source.js';

/**
 * The date Story Director's clock (`{ minutes, calendar }`) is on Delta's calendar `config`, or null when
 * Delta cannot write it there. Delta keeps its own calendar (its prompts' birthday shape and era are
 * unchanged), so the clock is used only where both calendars agree:
 * - Delta with no calendar of its own (numeric Gregorian dates): Story Director's Gregorian one
 *   (twelve months of the Gregorian lengths, with leap years) → { era: '', year, month: 'MM', day };
 * - Delta's own months: Story Director's must be the same months (names, ignoring case, and lengths, in
 *   order) → { era: Delta's era, year, month: its name, day }; a leap day Delta's calendar has not got
 *   (the 29th of a 28-day month) gives null for that day.
 * Any other pair (a pack's calendar on one side only) gives null: Delta's own dates stand.
 */
export function storyClockDate(clock = null, config = null) {
    const parts = storyClockParts(clock?.minutes, clock?.calendar);
    if (!parts) return null;
    const shared = clock.calendar.months;
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) {
        const gregorian = clock.calendar.leapYears === true && shared.length === 12 && shared.every((month, at) => Number(month?.days) === GREGORIAN_DAYS[at]);
        if (!gregorian) return null;
        return normalizeCalendarDate({ era: '', year: parts.year, month: String(parts.monthIndex + 1).padStart(2, '0'), day: parts.day }, null);
    }
    const own = normalized.config.months;
    const same = own.length === shared.length && own.every((month, at) => normalizeMonthKey(month.name) === normalizeMonthKey(shared[at]?.name) && month.days === Number(shared[at]?.days));
    if (!same) return null;
    const month = own[parts.monthIndex];
    if (!month || parts.day > month.days) return null;
    return normalizeCalendarDate({ era: normalized.config.era, year: parts.year, month: month.name, day: parts.day }, normalized.config);
}

/** The story's date from the clock source on `config` (storyClockDate), or null without one. */
export function hostedStoryDate(config = getActiveCalendarConfig()) {
    if (!storyClockSource) return null;
    let clock = null;
    try { clock = readStoryClock(); } catch { return null; }
    return clock ? storyClockDate(clock, config) : null;
}

/** Today in the story when nothing more grounded is given: the hosted story date, else Delta's manual clock. */
export function storyCurrentDate(config = null) {
    return hostedStoryDate(config) || currentCalendarDate(config);
}
