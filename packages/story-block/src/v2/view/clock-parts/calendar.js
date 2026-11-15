// Reads calendar-like values and finds the calendar the story clock runs on.

import { GREGORIAN, isRecord } from './shared-gregorian.js';

/** `{ era, months: [{ name, days }], leapYears }` from a calendar-like value, or null when it has no months. */
export function calendarFrom(value) {
    if (!isRecord(value) || !Array.isArray(value.months)) return null;
    const months = value.months.map(month => {
        if (typeof month === 'string') {
            const [name, days] = month.split('|');
            return { name: name.trim(), days: Math.floor(Number(days)) || 30 };
        }
        return isRecord(month) ? { name: String(month.name ?? '').trim(), days: Math.floor(Number(month.days)) || 30 } : null;
    }).filter(month => month && month.name && month.days > 0);
    if (!months.length) return null;
    return { era: typeof value.era === 'string' ? value.era.trim() : '', months, leapYears: value.leapYears === true || value.preset === 'gregorian' };
}

/** The calendar the story clock is on, through `query(name, args)` (see the top of this file). */
export function storyCalendar(query) {
    for (const name of ['director.calendar', 'packs.calendar']) {
        let value = null;
        try { value = typeof query === 'function' ? query(name, {}) : null; } catch { value = null; }
        const calendar = calendarFrom(value);
        if (calendar) return calendar;
    }
    return calendarFrom(GREGORIAN);
}
