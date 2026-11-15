// Story Director v2, world: the chat's calendar, the story clock, and the date and time-of-day text.

import { PRESETS, makeCalendar } from '../../../calendar.js';
import { tryQuery } from './query.js';
import { isRecord, isInt, text } from './shared-text.js';

/** The chat's calendar (the tracker's `director.calendar`), else Gregorian. */
export function calendarFrom(query) {
    const config = tryQuery(query, 'director.calendar', {}, null);
    try {
        return makeCalendar(isRecord(config) ? config : PRESETS.gregorian);
    } catch {
        return makeCalendar(PRESETS.gregorian);
    }
}

/** The story clock in minutes, or null while it is not set. */
export function nowFrom(query, state) {
    const asked = tryQuery(query, 'director.time', {}, null);
    if (isInt(asked?.minutes)) return asked.minutes;
    const minutes = state?.domains?.director?.time?.minutes;
    return isInt(minutes) ? minutes : null;
}

export const dateText = (calendar, minutes, options) => {
    if (!isInt(minutes)) return '';
    try { return text(calendar.format(minutes, options)); } catch { return ''; }
};

// The time of day in `format`'s own words ("06:20 pm"): what follows the date in the full text.
export const clockText = (calendar, minutes) => {
    const day = dateText(calendar, minutes, { time: false });
    return day ? dateText(calendar, minutes).slice(day.length).replace(/^[\s,]+/, '') : '';
};
