// Formats trip dates, paces, and leg durations for display.

import { PRESETS, makeCalendar } from '../../../time/calendar.js';
import { isRecord } from '../domain.js';
import { modeWords } from './modes.js';
import { daysWord, isInt, tidy } from './shared-constants.js';

/** The chat's calendar from the `director.calendar` query, else Gregorian. */
export function calendarOf(query) {
    let config = null;
    try {
        config = typeof query === 'function' ? query('director.calendar', {}) : null;
    } catch {
        config = null;
    }
    try {
        return makeCalendar(isRecord(config) ? config : PRESETS.gregorian);
    } catch {
        return makeCalendar(PRESETS.gregorian);
    }
}

/** A story minute as "Goldwane 16" (with the era and year when it is in another year than `now`), or ''. */
export function dateText(calendar, minutes, now = null) {
    if (!isInt(minutes)) return '';
    try {
        const other = isInt(now) && calendar.fromAbs(minutes).year !== calendar.fromAbs(now).year;
        return calendar.format(minutes, { time: false, era: other });
    } catch {
        return '';
    }
}

/** "riding, 25 km/day (Burr sets the pace)" or "on foot, 20 km/day". */
export function paceText(trip) {
    const unit = trip.unit === 'hour' ? 'km/h' : 'km/day';
    const note = trip.mount ? ` (${trip.mount} sets the pace)` : trip.short ? ' (not enough mounts: the party walks)' : '';
    return `${modeWords(trip.mode)}, ${trip.pace} ${unit}${note}`;
}

/** A leg's time in words: "4 days", "5 hours". */
export const legTime = (leg, unit) => (unit === 'hour' ? (() => { const hours = tidy(leg.days * 24); return hours === 1 ? '1 hour' : `${hours} hours`; })() : daysWord(leg.days));
