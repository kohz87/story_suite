// Story Director v2, tracker part: a story minute as the editor's date parts and the hero's text, and the check of an edited date.

import { MAX_YEAR } from '../time.js';
import { isInt, isRecord } from './shared-guards.js';

/** The date and time of story minute `abs` as the editor shows them: `{ year, month, day, minutes }` (month and day from 1). */
export function partsOf(calendar, abs) {
    if (!isInt(abs)) return null;
    try {
        const { year, month, day, minutes } = calendar.fromAbs(abs);
        return { year, month: month + 1, day, minutes };
    } catch {
        return null;
    }
}

// The clock as the Game view's hero writes it (Story Block's `fmt.time`): "6:00 pm", no leading zero.
const clockText = minutes => `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${minutes < 720 ? 'am' : 'pm'}`;

/**
 * Story minute `abs` written as the hero shows it: "CY 611, Goldwane 12, 7:40 pm" ("Goldwane 12, 611, 7:40 pm" for a calendar
 * without an era); `year: false` leaves out the era and the year ("Goldwane 12, 7:40 pm").
 */
export function heroDate(calendar, abs, { year = true } = {}) {
    const date = calendar.fromAbs(abs);
    const day = `${calendar.config.months[date.month].name} ${date.day}`;
    const dated = !year ? day : calendar.config.era ? `${calendar.config.era} ${date.year}, ${day}` : `${day}, ${date.year}`;
    return `${dated}, ${clockText(date.minutes)}`;
}

/**
 * What is wrong with a date and time on `calendar`, in one plain sentence that names the field, or '' when it is a date there.
 * `{ year, month, day, minutes }` as the command takes them.
 */
export function clockProblem(calendar, input) {
    const fields = ['year', 'month', 'day', 'minutes'];
    if (!isRecord(input) || !fields.every(key => isInt(input[key]))) return 'Pick a date and a time.';
    const { year, month, day, minutes } = input;
    const months = calendar.config.months;
    if (Math.abs(year) > MAX_YEAR) return `Pick a year between -${MAX_YEAR} and ${MAX_YEAR}.`;
    if (month < 1 || month > months.length) return 'Pick a month from the list.';
    if (day < 1) return 'Day must be 1 or more.';
    const days = calendar.daysInMonth(year, month - 1);
    if (day > days) {
        const name = months[month - 1].name;
        // The leap month's length depends on the year, so say which year the count is for.
        const leapMonth = months.length > 1 ? 1 : 0;
        return calendar.config.leapYears && month - 1 === leapMonth ? `${name} has ${days} days in ${year}.` : `${name} has ${days} days.`;
    }
    if (minutes < 0 || minutes > 1439) return 'Pick a time of day.';
    return '';
}
