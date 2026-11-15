// The first enabled pack's single tables: the {{user}} rank, the calendar, the weather and the money scale.

import { copy } from './shared-copy.js';

/**
 * The Rank the first enabled pack (in list order) that declares one gives {{user}}'s look (`content.you.rank`, MODULES §F126), as
 * `{ pack, label }`, or null: a story with no such pack has no Rank.
 */
export function youRankOf(packs) {
    const pack = packs.find(entry => entry.content?.you?.rank?.label);
    return pack ? { pack: pack.id, label: pack.content.you.rank.label } : null;
}

/**
 * The calendar for the story clock: the first enabled pack (in list order) that has one, as
 * `{ pack, era, months: [{ name, days }], start: { year, month, day, hour, minute } | null }`,
 * or null. `start.month` is the month's name. Calendars are not mixed across packs.
 */
export function calendarOf(packs) {
    const pack = packs.find(entry => entry.calendar);
    return pack ? copy({ pack: pack.id, ...pack.calendar }) : null;
}

/**
 * The weather table of the first enabled pack (in list order) that has one (MODULES §F122), as
 * `{ pack, seasons: [{ name, months }], tables: [{ season, region, weather: [text] }] }`, or null.
 * Tables are not mixed across packs. Read by a module that sets the weather by rule (Story Director).
 */
export function weatherOf(packs) {
    const pack = packs.find(entry => entry.weather);
    return pack ? copy({ pack: pack.id, seasons: pack.weather.seasons ?? [], tables: pack.weather.tables }) : null;
}

/**
 * The money scale of the first enabled pack (in list order) that sets one, as `{ pack, scale, note }`, or
 * null (MODULES §F104). Scales are not mixed across packs. Story Block's `inventory.economy` reads it.
 */
export function economyOf(packs) {
    const pack = packs.find(entry => entry.economy);
    return pack ? { pack: pack.id, scale: pack.economy.scale, note: pack.economy.note } : null;
}
