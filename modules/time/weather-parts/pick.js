// Story Director v2, part time: the region, key, seed and (format 3) region table the day's weather is picked from. Format 3 weather tables are read as before until they are removed (X1).

import { WEATHER_KEY_CHARS } from './names.js';
import { TEMPERATE } from './seasons.js';
import { cutPoints, fold, text, tryQuery } from './shared-text.js';

const DAY_MINUTES = 1440;

/** FNV-1a (32 bit) of a string: the seed of a day's pick. */
export function hashOf(value) {
    let hash = 0x811c9dc5;
    for (const point of Array.from(String(value))) {
        hash ^= point.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

const regionFits = (table, region) => {
    const want = fold(table.region);
    return Boolean(want) && Boolean(region) && (region === want || region.includes(want));
};

/** The list of weathers to pick from (see the header), never empty. */
export function tableFor(packWeather, season, region) {
    const tables = Array.isArray(packWeather?.tables) ? packWeather.tables.filter(table => Array.isArray(table?.weather) && table.weather.some(entry => text(entry))) : [];
    const name = season?.name ?? '';
    const seasonFits = table => Boolean(name) && fold(table.season) === name;
    const anySeason = table => !fold(table.season);
    const anyRegion = table => !fold(table.region);
    const found = tables.find(table => seasonFits(table) && regionFits(table, region))
        ?? tables.find(table => seasonFits(table) && anyRegion(table))
        ?? tables.find(table => anySeason(table) && regionFits(table, region))
        ?? tables.find(table => anySeason(table) && anyRegion(table));
    if (found) return found.weather.map(text).filter(Boolean);
    return [...TEMPERATE[season?.builtIn ?? 'any']];
}

/** The region the weather is picked for: the scene's, else the atlas's for the place; folded, '' for none. */
export function regionOf(state, query) {
    const own = fold(state?.domains?.scene?.place?.region);
    if (own) return own;
    return fold(tryQuery(query, 'atlas.here', {})?.region);
}

/**
 * The key the weather is set for: the story day (`-` without a clock) and the region, at most 80 code points. A climate other than temperate (pack format 4) is added at the
 * end, so a place of another climate in the same region the same day has its own weather; the region is cut to make room.
 */
export function weatherKey(minutes, region, climate = '') {
    const day = Number.isSafeInteger(minutes) ? `day ${Math.floor(minutes / DAY_MINUTES)}` : 'no day';
    if (!climate || climate === 'temperate') return cutPoints(`${day}|${region}`, WEATHER_KEY_CHARS);
    return `${cutPoints(`${day}|${region}`, WEATHER_KEY_CHARS - climate.length - 1)}|${climate}`;
}
