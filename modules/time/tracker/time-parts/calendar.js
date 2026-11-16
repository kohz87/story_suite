// The chat's calendar: the packs' calendar, the config the chat runs on, and a pack start date as story minutes.

import { PRESETS, makeCalendar, normalizeCalendar } from '../../calendar.js';
import { PACK_PRESET } from './constants.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The enabled packs' calendar through a query function (ctx.query, view.query, tools.query):
 * `{ pack, era, months: [{ name, days }], start }` or null (no pack has one, or no packs part).
 */
export function packCalendarOf(query) {
    if (typeof query !== 'function') return null;
    try {
        const value = query('packs.calendar', {});
        return isRecord(value) && Array.isArray(value.months) && value.months.length ? value : null;
    } catch {
        return null;
    }
}

/**
 * The calendar config the chat runs on (normalizeCalendar's shape): the reader's own when they chose
 * `gregorian` or `custom`; with the default preset `pack`, the pack's calendar (`packCalendar`, see
 * packCalendarOf) when there is one, else Gregorian.
 */
export function calendarConfig(settings, packCalendar = null) {
    const own = settings?.calendar ?? null;
    const preset = typeof own === 'string' ? own : isRecord(own) ? own.preset : PACK_PRESET;
    if (preset === PACK_PRESET || own === null) {
        if (isRecord(packCalendar) && Array.isArray(packCalendar.months) && packCalendar.months.length) {
            return normalizeCalendar({ preset: 'custom', era: String(packCalendar.era ?? ''), months: packCalendar.months, leapYears: false });
        }
        return normalizeCalendar(PRESETS.gregorian);
    }
    return normalizeCalendar(own);
}

/** The chat's calendar (makeCalendar) from the module's settings and the packs' calendar. */
export function calendarOf(settings, packCalendar = null) {
    return makeCalendar(calendarConfig(settings, packCalendar));
}

/**
 * The story time a pack's `start` (`{ year, month: name, day, hour, minute }`) is on `calendar`, in
 * minutes, or null when it is not a date there (a month the calendar has not got, a day past the
 * month's end).
 */
export function startMinutes(calendar, start) {
    if (!isRecord(start)) return null;
    const { year, day, hour = 0, minute = 0 } = start;
    if (![year, day, hour, minute].every(Number.isSafeInteger)) return null;
    if (day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const name = String(start.month ?? '').trim().toLowerCase();
    const month = calendar.config.months.findIndex(entry => entry.name.toLowerCase() === name);
    if (month < 0 || day > calendar.daysInMonth(year, month)) return null;
    const minutes = calendar.toAbs({ year, month, day, minutes: hour * 60 + minute });
    return Number.isSafeInteger(minutes) ? minutes : null;
}
