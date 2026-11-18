// The job: checking a game pack's `content.calendar` (months, era, holidays, leap years, week, seasons; no start date).

import { GAME_CALENDAR_FIELDS, GAME_CALENDAR_LIMITS } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isObject } from '../core.js';
import { checkCalendar } from '../world.js';
import { checkSeasons } from './seasons.js';

/**
 * The months, era and holidays go through the format 3 calendar check unchanged (it is given only those three). Then `leapYears` (true or false),
 * `week` (1 to 14 day names, once each) and `seasons` (seasons.js). → `{ era, months, holidays?, leapYears?, week?, seasons? }` or null (the problems are said).
 */
export function checkGameCalendar(calendar, add) {
    const at = 'content.calendar';
    if (!isObject(calendar)) { add('BAD_CALENDAR', at, 'calendar must be { "months": [{ "name", "days" }], "era": …, "seasons": […] }.'); return null; }
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_CALENDAR', path, message); };
    for (const key of Object.keys(calendar)) {
        if (key === 'start') bad(`${at}.start`, 'calendar.start belongs in the world pack, as content.start.date: a game pack has no year.');
        else if (!GAME_CALENDAR_FIELDS.includes(key)) add('UNKNOWN_FIELD', `${at}.${key}`, `"${key}" is not a calendar field (expected ${GAME_CALENDAR_FIELDS.join(', ')}).`);
    }
    const base = {};
    for (const key of ['era', 'months', 'holidays']) if (calendar[key] !== undefined) base[key] = calendar[key];
    const checked = checkCalendar(base, (code, path, message) => add(code, path.replace(/^calendar/, at), message));
    if (!checked) return null;
    const L = GAME_CALENDAR_LIMITS;
    let leapYears;
    if (calendar.leapYears !== undefined) {
        if (typeof calendar.leapYears !== 'boolean') bad(`${at}.leapYears`, 'leapYears must be true or false.');
        else leapYears = calendar.leapYears;
    }
    let week;
    if (calendar.week !== undefined) {
        const given = calendar.week;
        const names = Array.isArray(given) ? given.map(day => (typeof day === 'string' && day.length <= L.dayName ? oneLine(day, L.dayName) : '')) : [];
        if (!Array.isArray(given) || !given.length || given.length > L.week || names.some(day => !day)) bad(`${at}.week`, `week must be a list of 1 to ${L.week} day names of at most ${L.dayName} characters.`);
        else if (new Set(names.map(foldKey)).size !== names.length) bad(`${at}.week`, 'two days of the week have the same name.');
        else week = names;
    }
    const seasons = calendar.seasons === undefined ? undefined : checkSeasons(calendar.seasons, checked.months, add);
    if (seasons === null) ok = false;
    if (!ok) return null;
    return {
        era: checked.era, months: checked.months,
        ...(checked.holidays ? { holidays: checked.holidays } : {}),
        ...(leapYears !== undefined ? { leapYears } : {}), ...(week ? { week } : {}), ...(seasons ? { seasons } : {}),
    };
}
