// World events, the daily step: the chat's calendar as the step reads it: the season of a clock day (calendar quarters, spec ruling 27/B8),
// the stretch of a season a day sits in, and a fixed date `<year>-<month>-<day>` (month by number or name) as a clock day. Pure.

import { PRESETS, makeCalendar } from '../../time/calendar.js';
import { seasonByYear } from '../../time/weather-parts/seasons.js';

const DAY = 1440;
const fold = text => String(text ?? '').trim().toLowerCase();

const QUARTERS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

/** `makeStepCalendar(config, seasons?)` → `{ seasonOf, stretch, dateDay, dateProblem, hasSeason }`; an unreadable or missing config is Gregorian. `seasons`: the game's `[{ name, months: [names] }]` (the frame's calendar); with none, or none that names a month of this calendar, the year splits into the four built-in quarters. */
export function makeStepCalendar(config, seasons = null) {
    let calendar;
    try { calendar = makeCalendar(config && typeof config === 'object' ? config : PRESETS.gregorian); } catch { calendar = makeCalendar(PRESETS.gregorian); }
    const months = calendar.config.months;
    const yearDays = months.reduce((sum, month) => sum + month.days, 0) || 1;
    const monthNames = new Set(months.map(month => fold(month.name)));
    const own = (Array.isArray(seasons) ? seasons : []).filter(season => typeof season?.name === 'string' && Array.isArray(season.months));
    const owned = own.length > 0 && own.every(season => season.months.every(name => monthNames.has(fold(name))));
    const seasonCache = new Map();
    const seasonOf = day => {
        if (!seasonCache.has(day)) {
            const at = calendar.fromAbs(day * DAY);
            if (owned) {
                const hit = own.find(season => season.months.some(name => fold(name) === fold(months[at.month]?.name)));
                seasonCache.set(day, hit ? fold(hit.name) : '');
                return seasonCache.get(day);
            }
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
    /** Why a fixed date `<year>-<month>-<day>` is not on this calendar (no such month, or the day is past its length), or '' when it is. */
    const dateProblem = text => {
        const match = /^(-?\d+)-([^-]+)-(\d+)$/.exec(String(text ?? '').trim());
        if (!match) return '';
        const at = /^\d+$/.test(match[2]) ? Number(match[2]) - 1 : months.findIndex(entry => fold(entry.name) === fold(match[2]));
        if (at < 0 || at >= months.length) return `the calendar has no month "${match[2]}"`;
        return Number(match[3]) >= 1 && Number(match[3]) <= months[at].days ? '' : `${months[at].name} has ${months[at].days} days, not ${match[3]}`;
    };
    /** Whether the calendar has a season of this name (the game's own names, else the four quarters). */
    const hasSeason = name => (owned ? own.some(season => fold(season.name) === fold(name)) : QUARTERS.includes(fold(name)));
    return { seasonOf, stretch, dateDay, dateProblem, hasSeason };
}
