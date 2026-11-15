/* Day arithmetic: ordinals within a year, absolute day numbers and the legacy story-day migration. */

import { calendarYearLength, getActiveCalendarConfig, normalizeCalendarConfig, normalizeMonthKey } from '../calendar-config.js';
import { legacyLeapYear, legacyMonthDays } from './shared-legacy-days.js';
import { normalizeCalendarDate } from './parse.js';

export function dateOrdinal(value, config = null) {
    const date = normalizeCalendarDate(value, config);
    if (!date) return null;
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (normalized.calendarValid) {
        let ordinal = 0;
        for (const month of normalized.config.months) {
            if (normalizeMonthKey(month.name) === normalizeMonthKey(date.month)) return ordinal + date.day - 1;
            ordinal += month.days;
        }
        return null;
    }
    if (!/^\d{2}$/.test(date.month)) return null;
    const monthNumber = Number(date.month);
    let ordinal = 0;
    for (let month = 1; month < monthNumber; month += 1) ordinal += legacyMonthDays(month, null);
    return ordinal + date.day - 1;
}

// Numeric fallback dates are Gregorian: real leap days are counted, so consecutive dates (Dec 31 to
// Jan 1, non-leap Feb 28 to Mar 1) are exactly one day apart.
function gregorianDayNumber(year, monthNumber, day) {
    const prior = year - 1;
    let days = 365 * year + Math.floor(prior / 4) - Math.floor(prior / 100) + Math.floor(prior / 400);
    for (let month = 1; month < monthNumber; month += 1) days += legacyMonthDays(month, year);
    return days + day - 1;
}

// Stored story days carry STORY_DAY_SCHEME once written by the Gregorian numeric arithmetic. Before
// it, numeric fallback days were year*365 plus a 366-day ordinal; such an unmarked value is converted
// (to within the old formula's own one-day collisions) so spans never mix the two numberings. A
// configured calendar's numbering is unchanged and passes through.
export const STORY_DAY_SCHEME = 2;

export function migrateLegacyStoryDay(value, config = getActiveCalendarConfig()) {
    const day = Number(value);
    if (!Number.isInteger(day)) return null;
    if (normalizeCalendarConfig(config, { requireCurrentDate: false }).calendarValid) return day;
    const year = Math.floor(day / 365);
    let ordinal = day - year * 365;
    let month = 1;
    while (month < 12 && ordinal >= legacyMonthDays(month, null)) {
        ordinal -= legacyMonthDays(month, null);
        month += 1;
    }
    // The old ordinal always reserved Feb 29; in a common year that slot is Mar 1's predecessor.
    if (month === 2 && ordinal === 28 && !legacyLeapYear(year)) return gregorianDayNumber(year, 3, 1) - 1;
    return gregorianDayNumber(year, month, ordinal + 1);
}

// Absolute day count for a dated calendar value, so two story dates can be compared as elapsed
// days. Undated or yearless values return null; the caller then falls back to turns.
export function calendarDayNumber(value, config = null) {
    const date = normalizeCalendarDate(value, config);
    if (!date || date.year === null) return null;
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) {
        if (!/^\d{2}$/.test(date.month)) return null;
        return gregorianDayNumber(Number(date.year), Number(date.month), date.day);
    }
    const ordinal = dateOrdinal(date, config);
    if (ordinal === null) return null;
    const yearLength = calendarYearLength(config);
    return yearLength > 0 ? date.year * yearLength + ordinal : null;
}
