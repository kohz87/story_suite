// Writes story minutes in words: the clock time, the full dated text, and the `fmt.time` formatter.

import { calendarFrom, storyCalendar } from './calendar.js';
import { dateOf } from './dates.js';
import { GREGORIAN } from './shared-gregorian.js';

/** "7:40 pm" */
export function clockText(minutes) {
    const hour = Math.floor(minutes / 60);
    return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

/** "CY 611, Goldwane 12, 7:40 pm" (no era: "Goldwane 12, 611, 7:40 pm"); '' for a value that is not a time. */
export function formatStoryTime(minutes, calendar = null) {
    if (!Number.isSafeInteger(minutes) || minutes < 0) return '';
    const cal = calendarFrom(calendar) ?? calendarFrom(GREGORIAN);
    const date = dateOf(minutes, cal);
    const day = `${cal.months[date.month].name} ${date.day}`;
    const dated = cal.era ? `${cal.era} ${date.year}, ${day}` : `${day}, ${date.year}`;
    return `${dated}, ${clockText(date.minutes)}`;
}

/** `fmt.time` for templates: minutes → words, on the calendar `query` finds (looked up on each call). */
export const timeFormatter = query => minutes => formatStoryTime(minutes, storyCalendar(query));
