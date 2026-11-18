// The chat's calendar: the game's calendar (from the chat's frame, else the selected game), the config the chat runs on, and a world start date as story minutes.

import { PRESETS, makeCalendar, normalizeCalendar } from '../../calendar.js';
import { GAME_PRESET, LEGACY_PACK_PRESET } from './constants.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasMonths = value => isRecord(value) && Array.isArray(value.months) && value.months.length > 0;

function ask(query, name, args = {}) {
    try {
        return query(name, args);
    } catch {
        return null;
    }
}

/**
 * The game's calendar through a query function (ctx.query, view.query, tools.query):
 * `{ pack, era, months: [{ name, days }], leapYears?, week?, seasons?, start }` or null (no game gives one, or no packs part); with the built-in game and a
 * world that has a start date, `{ pack: null, builtIn: true, era, months: [], start }` (the date on the Gregorian calendar).
 * A chat that has a frame (`packs.frame`, pack format 4) reads the calendar the frame recorded at its start, so a game swapped in
 * Settings later does not move its dates; a frame of the built-in game has none (Gregorian). Without a frame it is the selected game's
 * (`packs.calendar`). The start date (and a built-in game's era) comes from the selected world, and only while that world and game are the chat's.
 */
export function packCalendarOf(query) {
    if (typeof query !== 'function') return null;
    const live = ask(query, 'packs.calendar');
    const frame = ask(query, 'packs.frame');
    if (isRecord(frame) && frame.set === true) {
        const worldNow = isRecord(live) && live.world ? live.world : null;
        const sameWorld = worldNow !== null && isRecord(frame.world) && frame.world.pack === worldNow;
        if (!hasMonths(frame.calendar)) {
            // The built-in game: the world the chat began with gives its start and era (a world installed later moves nothing). A game selected or installed
            // since leaves the chat on the built-in game, so its calendar is still the world's built-in one (SFF4 #2: the era stayed, not "October 2, 611").
            if (frame.game !== 'built-in' || !sameWorld) return null;
            const own = live?.builtIn === true ? live : ask(query, 'packs.calendar', { builtIn: true });
            return isRecord(own) && own.builtIn === true && own.world === worldNow ? structuredClone(own) : null;
        }
        const out = { pack: isRecord(frame.game) ? frame.game.pack : null, ...structuredClone(frame.calendar), start: null };
        if (hasMonths(live) && live.pack === out.pack && live.start && sameWorld) out.start = structuredClone(live.start);
        return out;
    }
    return hasMonths(live) || live?.builtIn === true ? live : null;
}

/**
 * The calendar config the chat runs on (normalizeCalendar's shape): the reader's own when they chose
 * `gregorian` or `custom`; with the default preset `game` (format 3 stored it as `pack`), the game's calendar (`gameCalendar`, see
 * packCalendarOf: months, era, leap years, week) when there is one, else Gregorian.
 */
export function calendarConfig(settings, gameCalendar = null) {
    const own = settings?.calendar ?? null;
    const preset = typeof own === 'string' ? own : isRecord(own) ? own.preset : GAME_PRESET;
    if (preset === GAME_PRESET || preset === LEGACY_PACK_PRESET || own === null) {
        if (hasMonths(gameCalendar)) {
            return normalizeCalendar({
                preset: 'custom', era: String(gameCalendar.era ?? ''), months: gameCalendar.months,
                leapYears: gameCalendar.leapYears === true, week: Array.isArray(gameCalendar.week) ? gameCalendar.week : [],
            });
        }
        // The built-in game: Gregorian, with the world's era when it names one.
        return normalizeCalendar(gameCalendar?.builtIn === true && gameCalendar.era ? { ...PRESETS.gregorian, era: String(gameCalendar.era) } : PRESETS.gregorian);
    }
    return normalizeCalendar(own);
}

/** The chat's calendar (makeCalendar) from the module's settings and the game's calendar. */
export function calendarOf(settings, gameCalendar = null) {
    return makeCalendar(calendarConfig(settings, gameCalendar));
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
