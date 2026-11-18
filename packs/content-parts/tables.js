// The first enabled pack's single tables: the {{user}} rank, the calendar, the weather and the money scale.

import { copy } from './shared-copy.js';
import { GREGORIAN_NAMES, gregorianLeap } from './gregorian.js';

/**
 * The Rank the first enabled pack (in list order) that declares one gives {{user}}'s look (`content.you.rank`, MODULES §F126), as
 * `{ pack, label }`, or null: a story with no such pack has no Rank. `own` is the reader's own label (Settings › Start): when set it is the label (`pack` is then null).
 */
export function youRankOf(packs, own = '') {
    if (typeof own === 'string' && own.trim()) return { pack: null, label: own.trim() };
    const pack = packs.find(entry => entry.content?.you?.rank?.label);
    return pack ? { pack: pack.id, label: pack.content.you.rank.label } : null;
}

/**
 * The calendar for the story clock: the first enabled pack (in list order) that has one, as
 * `{ pack, world, era, months: [{ name, days }], start: { year, month, day, hour, minute } | null }`,
 * or null. `start.month` is the month's name; `world` is the id of the world the start came from (null without one). Calendars are not mixed across packs.
 * With no game calendar, a world with a start date gives the built-in game's: `{ pack: null, world, builtIn: true, era, months: [], start }`, the date on the
 * Gregorian calendar (the time module runs its Gregorian preset; design §1.3).
 */
export function calendarOf(packs) {
    const pack = packs.find(entry => entry.calendar);
    const world = packs.find(entry => entry.kind === 'world' && entry.start?.date) ?? null;
    if (!pack) return world ? builtInStart(world) : null;
    const out = { pack: pack.id, world: null, ...pack.calendar };
    // Format 4: the game's calendar has no start; the selected world's `start.date` (a month number) gives it. A month the calendar lacks, or a day past the month,
    // falls back to day 1 of month 1 of that year (the pairing check's PAIR_START_DATE says so).
    const date = pack.kind === 'game' ? world?.start.date : null;
    if (date) {
        const month = pack.calendar.months[date.month - 1];
        const fits = month && date.day <= month.days;
        const at = fits ? { month: month.name, day: date.day } : { month: pack.calendar.months[0].name, day: 1 };
        out.start = { year: date.year, ...at, hour: date.hour ?? 0, minute: date.minute ?? 0 };
        out.world = world.id;
        // The world's era comes before the game calendar's (a year number is lore); the reader's Settings row comes before both.
        if (typeof date.era === 'string' && date.era) out.era = date.era;
    }
    return copy(out);
}

/** The world's start date on the built-in Gregorian calendar (February has 29 days only in a leap year); a date that is not there falls back to January 1 of that year. */
function builtInStart(world) {
    const date = world.start.date;
    const days = month => (month === 2 ? (gregorianLeap(date.year) ? 29 : 28) : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]);
    const fits = Number.isInteger(date.month) && date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= days(date.month);
    const at = fits ? { month: GREGORIAN_NAMES[date.month - 1], day: date.day } : { month: GREGORIAN_NAMES[0], day: 1 };
    return copy({ pack: null, world: world.id, builtIn: true, era: typeof date.era === 'string' ? date.era : '', months: [], start: { year: date.year, ...at, hour: date.hour ?? 0, minute: date.minute ?? 0 } });
}

/**
 * The weather table of the first enabled pack (in list order) that has one (MODULES §F122), as
 * `{ pack, seasons: [{ name, months }], tables: [{ season, region, weather: [text] }] }`, or null.
 * Tables are not mixed across packs. Read by a module that sets the weather by rule (Story Director).
 */
export function weatherOf(packs) {
    const pack = packs.find(entry => entry.weather);
    if (!pack) return null;
    // Format 4: the game's seasons are its calendar's and `style` says where the weather comes from. The region-keyed reader (time/weather-parts/pick.js) takes a table with
    // no region for every region, so it is given only the season-only tables of style "tables"; the climate tables wait in `climateTables` for the climate reader (a later job).
    if (pack.kind === 'game') {
        const { style, tables } = pack.weather;
        return copy({ pack: pack.id, style, seasons: pack.calendar?.seasons ?? [], tables: style === 'tables' ? tables.filter(table => !table.climate) : [], climateTables: style === 'story' ? [] : tables.filter(table => table.climate) });
    }
    return copy({ pack: pack.id, seasons: pack.weather.seasons ?? [], tables: pack.weather.tables });
}

/**
 * The money scale of the first enabled pack (in list order) that sets one, as `{ pack, scale, note }`, or
 * null (MODULES §F104). Scales are not mixed across packs. Story Block's `inventory.economy` reads it.
 */
export function economyOf(packs) {
    const pack = packs.find(entry => entry.economy);
    return pack ? { pack: pack.id, scale: pack.economy.scale, note: pack.economy.note } : null;
}
