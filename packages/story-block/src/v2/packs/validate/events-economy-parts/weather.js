// Checking a pack's weather tables and ripples.

import { SLUG, WEATHER_LIMITS, WEATHER_FIELDS, WEATHER_SEASON_FIELDS, CALENDAR_LIMITS, WEATHER_TABLE_FIELDS, RIPPLES_FIELDS, RIPPLES_POWER_FIELDS, RIPPLES_TIERS, RIPPLES_CAPS, RIPPLES_LIMITS } from '../../limits.js';
import { oneLine, foldKey } from '../../../../../../../core/text.js';
import { isObject, isText, isInt } from '../core.js';

/*
 * A pack's weather (MODULES §F122): `{ seasons?, tables }`, plain data a module that sets the weather by
 * rule reads (Story Director, from its calendar and the scene's region). `seasons`: at most 12
 * `{ name, months: [month name] }` (a month in one season only; the names are the calendar's months);
 * `tables`: 1 to 120 `{ season?, region?, weather: [1 to 24 texts of at most 60 characters] }`, a table
 * without `season` or `region` for any. Texts are kept on one line. Problems are `BAD_WEATHER`.
 */
export function checkWeather(weather, add) {
    let ok = true;
    const say = (path, message, code = 'BAD_WEATHER') => { ok = false; add(code, path, message); };
    const L = WEATHER_LIMITS;
    if (!isObject(weather)) {
        say('weather', 'weather must be { "seasons": [ … ], "tables": [{ "season", "region", "weather": [ … ] }] }.');
        return null;
    }
    for (const key of Object.keys(weather)) if (!WEATHER_FIELDS.includes(key)) say(`weather.${key}`, `"${key}" is not a weather field (expected ${WEATHER_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const word = (value, max) => (typeof value === 'string' && value.trim() && value.length <= max ? oneLine(value, max) : '');
    const seasons = [];
    if (weather.seasons !== undefined) {
        const months = new Set();
        if (!Array.isArray(weather.seasons) || weather.seasons.length > L.seasons) say('weather.seasons', `seasons must be a list of at most ${L.seasons} { "name", "months" }.`);
        else weather.seasons.forEach((season, index) => {
            const at = `weather.seasons[${index}]`;
            if (!isObject(season) || Object.keys(season).some(key => !WEATHER_SEASON_FIELDS.includes(key))) return say(at, `${at} must be { "name", "months" }.`);
            const name = word(season.name, L.season);
            if (!name) return say(`${at}.name`, `name must be text of at most ${L.season} characters (a season, like "winter").`);
            const list = Array.isArray(season.months) ? season.months.map(month => word(month, CALENDAR_LIMITS.monthName)) : [];
            if (!list.length || list.length > L.months || list.some(month => !month)) return say(`${at}.months`, `months must be a list of 1 to ${L.months} month names.`);
            for (const month of list) {
                if (months.has(foldKey(month))) return say(`${at}.months`, `"${month}" is in two seasons.`);
                months.add(foldKey(month));
            }
            seasons.push({ name, months: list });
        });
    }
    const tables = [];
    if (!Array.isArray(weather.tables) || !weather.tables.length || weather.tables.length > L.tables) say('weather.tables', `tables must be a list of 1 to ${L.tables} { "season", "region", "weather": [ … ] }.`);
    else weather.tables.forEach((table, index) => {
        const at = `weather.tables[${index}]`;
        if (!isObject(table) || Object.keys(table).some(key => !WEATHER_TABLE_FIELDS.includes(key))) return say(at, `${at} must be { "season", "region", "weather": [ … ] }.`);
        if (table.season !== undefined && !isText(table.season, L.season)) say(`${at}.season`, `season must be text of at most ${L.season} characters.`);
        if (table.region !== undefined && !isText(table.region, L.region)) say(`${at}.region`, `region must be text of at most ${L.region} characters.`);
        const kinds = Array.isArray(table.weather) ? table.weather.map(text => word(text, L.text)) : [];
        if (!kinds.length || kinds.length > L.kinds || kinds.some(text => !text)) return say(`${at}.weather`, `weather must be a list of 1 to ${L.kinds} texts of at most ${L.text} characters ("cold drizzle, low fog").`);
        tables.push({ season: typeof table.season === 'string' ? oneLine(table.season, L.season) : '', region: typeof table.region === 'string' ? oneLine(table.region, L.region) : '', weather: kinds });
    });
    return ok ? { ...(seasons.length ? { seasons } : {}), tables } : null;
}

/*
 * A pack's ripples table: `{ powers, tiers?, caps?, worldDirections?, standingModule? }`, read by Story Director's ripples part
 * (hidden sway per power from the player's deeds). `powers`: 1 to 12 `{ id (a slug), name, base 0..100, aliases?, factions?, givers?,
 * npcs?: [{ name, weight 1..3 }], standing?, standingBase? }`; `tiers` and `caps`: whole numbers by name; `worldDirections`: `{ event,
 * favours (a power id), unless? }`. A bad section is a pack Problem (`BAD_RIPPLES`), said once, and the section is not kept.
 */
export function checkRipples(ripples, add) {
    let ok = true;
    const say = (path, message, code = 'BAD_RIPPLES') => { ok = false; add(code, path, message); return null; };
    const L = RIPPLES_LIMITS;
    if (!isObject(ripples)) return say('ripples', 'ripples must be { "powers": [ … ], "tiers": { … }, "caps": { … }, "worldDirections": [ … ] }.');
    for (const key of Object.keys(ripples)) if (!RIPPLES_FIELDS.includes(key)) say(`ripples.${key}`, `"${key}" is not a ripples field (expected ${RIPPLES_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const text = (value, max = L.name) => (typeof value === 'string' && value.trim() && value.length <= max ? oneLine(value, max) : '');
    const names = (value, at) => {
        if (value === undefined) return [];
        const list = Array.isArray(value) ? value.map(item => text(item)) : [];
        if (!Array.isArray(value) || value.length > L.list || list.some(item => !item)) { say(at, `${at} must be a list of at most ${L.list} names of at most ${L.name} characters.`); return []; }
        return list;
    };
    const powers = [];
    if (!Array.isArray(ripples.powers) || !ripples.powers.length || ripples.powers.length > L.powers) say('ripples.powers', `powers must be a list of 1 to ${L.powers} powers.`);
    else ripples.powers.forEach((power, index) => {
        const at = `ripples.powers[${index}]`;
        if (!isObject(power)) return say(at, `${at} must be an object.`);
        for (const key of Object.keys(power)) if (!RIPPLES_POWER_FIELDS.includes(key)) say(`${at}.${key}`, `"${key}" is not a power field (expected ${RIPPLES_POWER_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof power.id !== 'string' || !SLUG.test(power.id) || power.id.length > L.id) return say(`${at}.id`, `id must be a lowercase slug of at most ${L.id} characters (like "wendhild").`);
        if (powers.some(other => other.id === power.id)) return say(`${at}.id`, `id "${power.id}" is used twice.`);
        const name = text(power.name);
        if (!name) return say(`${at}.name`, `name must be text of at most ${L.name} characters.`);
        if (!isInt(power.base) || power.base > 100) return say(`${at}.base`, 'base must be a whole number 0 to 100.');
        const npcs = [];
        if (power.npcs !== undefined) {
            if (!Array.isArray(power.npcs) || power.npcs.length > L.list) return say(`${at}.npcs`, `npcs must be a list of at most ${L.list} { "name", "weight" }.`);
            for (const npc of power.npcs) {
                if (!isObject(npc) || Object.keys(npc).some(key => key !== 'name' && key !== 'weight') || !text(npc.name) || (npc.weight !== undefined && !(isInt(npc.weight, 1) && npc.weight <= 3))) return say(`${at}.npcs`, 'an npc is { "name", "weight": 1 to 3 }.');
                npcs.push({ name: text(npc.name), weight: npc.weight ?? 1 });
            }
        }
        if (power.standing !== undefined && !text(power.standing)) return say(`${at}.standing`, 'standing must be the name of a standing key.');
        if (power.standingBase !== undefined && !Number.isSafeInteger(power.standingBase)) return say(`${at}.standingBase`, 'standingBase must be a whole number.');
        powers.push({
            id: power.id, name, base: power.base, aliases: names(power.aliases, `${at}.aliases`), factions: names(power.factions, `${at}.factions`),
            givers: names(power.givers, `${at}.givers`), npcs, ...(power.standing !== undefined ? { standing: text(power.standing) } : {}),
            ...(power.standingBase !== undefined ? { standingBase: power.standingBase } : {}),
        });
    });
    const numbers = (value, keys, max, at) => {
        if (value === undefined) return undefined;
        if (!isObject(value) || Object.keys(value).some(key => !keys.includes(key) || !isInt(value[key]) || value[key] > max)) { say(at, `${at} must map ${keys.join(', ')} to whole numbers 0 to ${max}.`); return undefined; }
        return { ...value };
    };
    const tiers = numbers(ripples.tiers, RIPPLES_TIERS, L.tier, 'ripples.tiers');
    const caps = numbers(ripples.caps, RIPPLES_CAPS, L.cap, 'ripples.caps');
    const directions = [];
    if (ripples.worldDirections !== undefined) {
        if (!Array.isArray(ripples.worldDirections) || ripples.worldDirections.length > L.directions) say('ripples.worldDirections', `worldDirections must be a list of at most ${L.directions} { "event", "favours", "unless" }.`);
        else ripples.worldDirections.forEach((entry, index) => {
            const at = `ripples.worldDirections[${index}]`;
            if (!isObject(entry) || Object.keys(entry).some(key => !['event', 'favours', 'unless'].includes(key)) || !text(entry.event)) return say(at, `${at} must be { "event", "favours", "unless" }.`);
            if (!powers.some(power => power.id === entry.favours)) return say(`${at}.favours`, 'favours must be the id of one of the powers.');
            directions.push({ event: text(entry.event), favours: entry.favours, unless: names(entry.unless, `${at}.unless`) });
        });
    }
    let standingModule = '';
    if (ripples.standingModule !== undefined) {
        standingModule = text(ripples.standingModule);
        if (!standingModule) say('ripples.standingModule', 'standingModule must be text (the standing data module\'s name).');
    }
    return ok ? { powers, ...(tiers ? { tiers } : {}), ...(caps ? { caps } : {}), ...(directions.length ? { worldDirections: directions } : {}), ...(standingModule ? { standingModule } : {}) } : null;
}
