// World events, the daily step: the chat's calendar as the step reads it: the season of a clock day (calendar quarters, spec ruling 27/B8),
// the stretch of a season a day sits in, and a fixed date `<year>-<month>-<day>` (month by number or name) as a clock day. Pure.

import { PRESETS, makeCalendar } from '../../time/calendar.js';

const DAY = 1440;
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const fold = text => String(text ?? '').trim().toLowerCase();

// The season of a day of the year: the year split as on Earth's northern half (the last and first twelfth are the middle of winter).
function seasonByYear(dayOfYear, yearDays) {
    const twelfth = ((dayOfYear + 0.5) / yearDays) * 12;
    return SEASONS[Math.floor(((Math.floor(twelfth) + 1) % 12) / 3)];
}

/** `makeStepCalendar(config)` → `{ seasonOf(day), stretch(day), dateDay(text) }`; an unreadable or missing config is Gregorian. */
export function makeStepCalendar(config) {
    let calendar;
    try { calendar = makeCalendar(config && typeof config === 'object' ? config : PRESETS.gregorian); } catch { calendar = makeCalendar(PRESETS.gregorian); }
    const months = calendar.config.months;
    const yearDays = months.reduce((sum, month) => sum + month.days, 0) || 1;
    const seasonCache = new Map();
    const seasonOf = day => {
        if (!seasonCache.has(day)) {
            const at = calendar.fromAbs(day * DAY);
            const before = months.slice(0, at.month).reduce((sum, month) => sum + month.days, 0);
            seasonCache.set(day, seasonByYear(before + at.day - 1, yearDays));
        }
        return seasonCache.get(day);
    };
    /** The run of days in the season `day` is in: `{ start, length }`. */
    const stretch = day => {
        const own = seasonOf(day);
        let start = day;
        while (day - start < 400 && seasonOf(start - 1) === own) start -= 1;
        let end = day;
        while (end - day < 400 && seasonOf(end + 1) === own) end += 1;
        return { start, length: end - start + 1 };
    };
    /** `612-07-30` or `612-Goldwane-12` → the clock day, or null when the calendar has no such month. */
    const dateDay = text => {
        const match = /^(-?\d+)-([^-]+)-(\d+)$/.exec(String(text ?? '').trim());
        if (!match) return null;
        const named = !/^\d+$/.test(match[2]);
        const month = named ? months.findIndex(entry => fold(entry.name) === fold(match[2])) : Number(match[2]) - 1;
        if (month < 0 || month >= months.length) return null;
        return calendar.dayIndex(calendar.toAbs({ year: Number(match[1]), month, day: Number(match[3]) }));
    };
    return { seasonOf, stretch, dateDay };
}
