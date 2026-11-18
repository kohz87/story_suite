// Story Director v2, part time: the built-in weather by climate and season (pack format 4, D9), and the climate of the place the story is at.

import { TEMPERATE } from './seasons.js';
import { fold, text, tryQuery } from './shared-text.js';

const lines = (...list) => Object.freeze(list);
const sky = (winter, spring, summer, autumn) => Object.freeze({ winter, spring, summer, autumn });

/** The built-in tables of every climate but `temperate` (that one is `TEMPERATE`), by built-in season; `underground` has one list for all seasons. */
export const CLIMATE_TABLES = Object.freeze({
    cold: sky(lines('bitter cold, clear and still', 'driving snow, a hard wind', 'iron-grey sky, ice on everything', 'snow squalls, then a pale sun'),
        lines('cold thaw, wet snow and mud', 'sharp wind, a few flakes', 'grey and raw, rain turning to sleet', 'cold and bright, meltwater running'),
        lines('cool and clear, a short bright day', 'cold rain, low cloud', 'chilly breeze, thin sun', 'mist at dawn, cool by noon'),
        lines('early snow on a north wind', 'cold rain, ice at the edges', 'raw and grey, the first hard frost', 'bright, bitter mornings')),
    frozen: sky(lines('white-out, wind that cuts', 'deep cold, the air still and glittering', 'blowing snow, no horizon', 'a pale sun that gives no warmth'),
        lines('hard frost, the ice groaning', 'bitter wind, flat grey light', 'snow in the air, a faint thaw at noon', 'clear and freezing'),
        lines('cold and bright, the snow glaring', 'thin mist over the ice', 'chill wind, patches of thaw', 'cold sun, long light'),
        lines('freezing fog, the ice creaking', 'snow squalls across the white', 'hard frost, the sky clear', 'a dark, bitter wind')),
    highland: sky(lines('snow on the heights, a thin cold wind', 'cloud on the peaks, driving sleet', 'hard frost, clear thin air', 'fog filling the valleys'),
        lines('rain on the hills, snow still above', 'wind across the tops, patches of sun', 'low cloud, drizzle in the glens', 'bright and sharp, meltwater loud'),
        lines('clear thin air, a cool wind', 'cloud on the ridges, rain by afternoon', 'warm sun in the valleys, cold above', 'a sudden storm over the tops'),
        lines('mist on the moors, steady rain', 'gusting wind, cloud racing', 'crisp and clear, first snow on the peaks', 'cold rain, the tops hidden')),
    arid: sky(lines('cold, dry and clear', 'a bitter wind off the sand', 'cool days, freezing nights', 'dry cold, a hazy sun'),
        lines('warm and dry, a dust haze', 'hot wind, the sky pale', 'clear and warm, cool at night', 'a dust devil on the flats'),
        lines('blazing sun, no shade', 'heat shimmer, the air like an oven', 'scorching and still', 'a dry hot wind, dust in the air'),
        lines('hot by day, cooling fast', 'dry and clear, a sharp dawn chill', 'a dusty wind, the sun veiled', 'a rare cloud, no rain')),
    warm: sky(lines('mild and dry, a soft sun', 'warm and breezy, a few clouds', 'a warm drizzle, clearing later', 'balmy, the air heavy'),
        lines('warm and bright, a light breeze', 'a shower and then sun', 'soft warmth, flowers on the wind', 'clear and pleasantly warm'),
        lines('hot and sunny', 'warm, humid, thunder by evening', 'sticky heat, a late storm', 'a hot, bright day with a sea breeze'),
        lines('warm and golden', 'a mild, heavy rain', 'warm and still, haze on the hills', 'a fresh breeze, the heat easing')),
    tropical: sky(lines('humid and hot, the air thick', 'a downpour, then steam rising', 'warm rain, grey sky', 'close and sticky, thunder far off'),
        lines('hot, humid, clouds building', 'an afternoon deluge', 'steaming heat, no wind', 'a warm squall off the water'),
        lines('sweltering, the sky white', 'a storm that comes and goes in an hour', 'heavy rain all morning', 'hot and wet, mist in the canopy'),
        lines('warm rain, the air dripping', 'humid, the clouds low', 'a bright, steaming morning', 'thunder rolling, rain by dusk')),
    coastal: sky(lines('a cold sea wind, spray on the quay', 'grey swell, squalls off the water', 'sea fog, gulls crying', 'cold and bright, a hard offshore wind'),
        lines('a salt breeze, rain showers', 'sea mist lifting by noon', 'fresh wind, white caps in the bay', 'cool and clear, the tide high'),
        lines('a warm sea breeze, gulls wheeling', 'bright, a haze over the water', 'calm and warm, the sea like glass', 'a squall rolling in from the sea'),
        lines('sea fog, the harbour bell tolling', 'a gusty onshore wind, cold rain', 'a long grey swell, a brightening sky', 'cool and salt-sharp, clear at dusk')),
    sea: sky(lines('a heavy grey swell, spray over the rail', 'a cold gale, the sky low', 'sleet on the wind, white water', 'a hard sea under a pale sun'),
        lines('a lively breeze, whitecaps', 'sea fog, the water flat', 'squalls and bright gaps', 'a steady wind, a rolling swell'),
        lines('a fair wind, the sea glittering', 'calm and hazy, the sails slack', 'a warm breeze, long low swells', 'a storm building on the horizon'),
        lines('a stiff wind, a short sea', 'drizzle and a grey horizon', 'a rising swell, the sky dark in the west', 'clear, a cold wind off the water')),
    underground: lines('still, cold air with a faint draught', 'damp air, water dripping somewhere', 'a slow draught carrying the smell of stone', 'close and stale, the air heavy',
        'a cool breath of air from deeper in', 'dripping walls, the air thick with damp', 'dry, dusty air, a faint draught', 'cold and wet, an echo in every step'),
});

function builtInLines(climate, builtIn) {
    if (climate === 'underground') return [...CLIMATE_TABLES.underground];
    // No clock, no season: every season of the climate's table (a climate with no table of its own, and temperate, give the mild table, as before).
    if (!builtIn && CLIMATE_TABLES[climate]) return Object.values(CLIMATE_TABLES[climate]).flat();
    return [...(CLIMATE_TABLES[climate]?.[builtIn] ?? TEMPERATE[builtIn ?? 'any'])];
}

const usable = table => Array.isArray(table?.weather) && table.weather.some(entry => text(entry));

/**
 * The list of weathers for a climate and season (never empty). `game` is the selected game's `packs.weather` (null for none, or for style "story"). Its tables win when they fit,
 * most exact first: its climate and season, its climate for any season; style "tables" also takes a table with no climate (its season, then any). Else the built-in table of the
 * climate and built-in season (`underground` has one list), and a climate the built-ins lack gives the temperate one.
 */
export function climateWeather(game, season, climate) {
    const name = season?.name ?? '';
    const climateTables = (Array.isArray(game?.climateTables) ? game.climateTables : []).filter(usable);
    const plain = game?.style === 'tables' ? (Array.isArray(game.tables) ? game.tables : []).filter(usable) : [];
    const own = table => fold(table.climate) === climate;
    const found = climateTables.find(table => own(table) && name && fold(table.season) === name)
        ?? climateTables.find(table => own(table) && !fold(table.season))
        ?? plain.find(table => name && fold(table.season) === name)
        ?? plain.find(table => !fold(table.season));
    if (found) return found.weather.map(text).filter(Boolean);
    return builtInLines(climate, season?.builtIn);
}

const sameName = (record, want) => Boolean(want) && [record?.id, record?.slug, record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].some(name => fold(name) === want);

/**
 * The climate of where the story stands: the pack place's own, `underground` for a place on the underground layer, else its region's (the region by id, name or alias:
 * the place's, else the scene's `region`, folded), else `temperate`. The selected world's records are asked as `packs.content` (an unreadable answer is no climate).
 */
export function climateOf(query, placeName, region) {
    const ask = kind => { const out = tryQuery(query, 'packs.content', { kind }); return Array.isArray(out) ? out : []; };
    const place = fold(placeName) ? ask('places').find(record => sameName(record, fold(placeName))) : null;
    if (place?.climate) return place.climate;
    if (fold(place?.layer) === 'underground') return 'underground';
    const wanted = fold(place?.region) || region;
    return (wanted ? ask('regions').find(record => sameName(record, wanted))?.climate : null) || (region && region !== wanted ? ask('regions').find(record => sameName(record, region))?.climate : null) || 'temperate';
}
