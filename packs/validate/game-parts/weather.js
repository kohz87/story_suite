// The job: checking a game pack's `content.weather` (the style, and tables keyed by climate and season).

import { CLIMATES, GAME_WEATHER_LIMITS, GAME_WEATHER_STYLES, GAME_WEATHER_TABLE_FIELDS } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isObject } from '../core.js';

// The built-in seasons, used when the game pack's calendar has none.
const BUILT_IN_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

/**
 * `{ style?: "climate" | "tables" | "story", tables?: [{ climate?, season?, weather: [text] }] }`. `style` is "climate" when left out. A table's climate must be
 * one of the ten known climates; `region` is refused (a game pack does not know the world). A season that matches none of the pack's own seasons (or the four
 * built-in ones when it has none) is a warning: the table would never be read. → `{ style, tables }` or null (the problems are said).
 */
export function checkGameWeather(weather, { add, warn, seasons }) {
    const at = 'content.weather';
    const L = GAME_WEATHER_LIMITS;
    if (!isObject(weather)) { add('BAD_WEATHER', at, 'weather must be { "style": "climate", "tables": [{ "climate", "season", "weather": [ … ] }] }.'); return null; }
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_WEATHER', path, message); };
    for (const key of Object.keys(weather)) if (key !== 'style' && key !== 'tables') add('UNKNOWN_FIELD', `${at}.${key}`, key === 'seasons' ? '"seasons" belongs in the calendar (content.calendar.seasons).' : `"${key}" is not a weather field (expected style, tables).`);
    if (weather.seasons !== undefined) ok = false;
    const style = weather.style === undefined ? 'climate' : weather.style;
    if (!GAME_WEATHER_STYLES.includes(style)) bad(`${at}.style`, `style must be one of ${GAME_WEATHER_STYLES.join(', ')}.`);
    const known = new Set((seasons?.length ? seasons.map(season => season.name) : BUILT_IN_SEASONS).map(foldKey));
    const tables = [];
    if (weather.tables !== undefined) {
        if (!Array.isArray(weather.tables) || !weather.tables.length || weather.tables.length > L.tables) bad(`${at}.tables`, `tables must be a list of 1 to ${L.tables} { "climate", "season", "weather": [ … ] }.`);
        else weather.tables.forEach((table, index) => {
            const here = `${at}.tables[${index}]`;
            if (!isObject(table)) return bad(here, `${here} must be { "climate", "season", "weather": [ … ] }.`);
            for (const key of Object.keys(table)) if (!GAME_WEATHER_TABLE_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `${here}.${key}`, key === 'region' ? 'region is not allowed: a game pack does not know the world. Use "climate".' : `"${key}" is not a weather table field (expected ${GAME_WEATHER_TABLE_FIELDS.join(', ')}).`); }
            if (table.climate !== undefined && !CLIMATES.includes(table.climate)) bad(`${here}.climate`, `climate must be one of ${CLIMATES.join(', ')}.`);
            if (table.season !== undefined && (typeof table.season !== 'string' || !table.season.trim() || table.season.length > L.season)) bad(`${here}.season`, `season must be text of 1 to ${L.season} characters.`);
            else if (typeof table.season === 'string' && !known.has(foldKey(table.season))) warn('UNUSED_SEASON', `${here}.season`, `"${table.season}" is not a season of this pack's calendar, so this table is never read.`);
            const lines = Array.isArray(table.weather) ? table.weather.map(text => (typeof text === 'string' && text.trim() && text.length <= L.text ? oneLine(text, L.text) : '')) : [];
            if (!lines.length || lines.length > L.kinds || lines.some(text => !text)) return bad(`${here}.weather`, `weather must be a list of 1 to ${L.kinds} texts of at most ${L.text} characters.`);
            tables.push({ climate: CLIMATES.includes(table.climate) ? table.climate : '', season: typeof table.season === 'string' ? oneLine(table.season, L.season) : '', weather: lines });
        });
    }
    if (ok && style === 'story' && tables.length) warn('UNUSED_TABLES', `${at}.tables`, 'style "story" leaves the weather to the narrator, so the tables are not read.');
    return ok ? { style, tables } : null;
}
