// Story Director v2, part screens: what the reply's Status card adds to the scene (`director.status`): the time, place, weather and the player's own condition.

import { heroDate } from '../../tracker/clock-set.js';
import { calendarFrom } from './calendar.js';
import { ask, queryFrom } from './shared-ask.js';
import { cut, isRecord, text } from './shared-words.js';

/** The part's queries; `settings` is the module's settings (a function or an object). */
const COORD_LIMIT = 1e7;
const WEATHER_CHARS = 80;
// {{user}}'s rank, what they wear and their condition (Story Block's `scene.you`, each at most 120 characters there).
const YOU_CHARS = 120;
const RANK_LABEL_CHARS = 30;

// A map coordinate as the card writes it: whole map units, '' when not a usable number.
const coordText = value => (Number.isFinite(value) && Math.abs(value) < COORD_LIMIT ? String(Math.round(value * 10) / 10) : '');

// The card's one-line summary, cut by code points (never inside a character).
const SUMMARY_CHARS = 80;
const summaryText = line => {
    const chars = Array.from(line);
    return chars.length > SUMMARY_CHARS ? `${chars.slice(0, SUMMARY_CHARS - 1).join('').trimEnd()}…` : line;
};

// The time of day as the card's one-line summary writes it: "1:30 pm" (no date, no leading zero).
export function clockText(calendar, minutes) {
    if (!calendar || !Number.isFinite(minutes)) return '';
    try {
        const day = Math.floor(calendar.fromAbs(minutes).minutes);
        const hour = Math.floor(day / 60);
        return `${hour % 12 || 12}:${String(day % 60).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
    } catch {
        return '';
    }
}

/**
 * The place's map position as text: its own, else its town's (the first part of the place line "Town · Spot", or of the scene's
 * name when the atlas does not have the place yet), so a spot with no point of its own still shows where it is.
 */
function coordsOf(query, here, placeName) {
    const has = place => isRecord(place) && coordText(place.x) && coordText(place.y);
    const own = isRecord(here) && text(here.id) ? ask(query, 'atlas.place', { id: here.id }, null) : null;
    if (has(own)) return [coordText(own.x), coordText(own.y)];
    const town = (text(here?.line) || placeName).split(/\s*(?:\||·|—|–)\s*/)[0];
    const up = town && town !== text(own?.name) ? ask(query, 'atlas.place', { name: town }, null) : null;
    return has(up) ? [coordText(up.x), coordText(up.y)] : ['', ''];
}

/**
 * `director.status` → what the reply's Status card adds to Story Block's scene, all of it {{user}}'s own
 * (world/known.js: where they are, the weather they stand in, their rank, what they wear and how they are): `{ summary, when, place, region, coords,
 * weather, rank, wearing, condition }`.
 * `when`: the story time as the Game view hero writes it ("CY 611, Goldwane 14, 6:00 pm"), for the card's Time row; '' while the clock is unset.
 * Display only: `director.time`'s `text` and the Director note keep their own words.
 * `summary`: the card's one line, "<clock time>, <place>" ("1:30 pm, Bluewatch Village"; each part is left out when the story has
 * not set it), for the one "This reply" line Story Block draws above the reply's cards.
 * `place`: the place line ("Auvoth · Southern Gatehouse": the atlas's `line`, else the scene's name); `region`: the place's own, else the scene's.
 * `coords`: the scene's place on the map ("59, 110", map units, one decimal: the atlas's or the pack's map data),
 * '' when the atlas does not know the place or has no position for it. `weather`: Story Block's
 * `scene.weather` (`{ text } | null`, the story's `~ weather <text>` line), '' when there is none or that
 * query is not there. `rank`, `rankLabel`, `wearing` and `condition`: Story Block's `scene.you` (`{ rank?, rankLabel?, wearing, condition } | null`, a Rank and its label only in a game whose pack gives one, the story's
 * `~ you rank: … | wearing: … | condition: …` line), '' for a part with no words, and all '' when Story Block is older than 2.10.0
 * (no such query) or has the feature off. Read on the state it is given, so each reply's card shows its own.
 */
export function statusExtras(state, _args, tools, { settings = null } = {}) {
    const query = queryFrom(tools);
    const minutes = state?.domains?.director?.time?.minutes;
    const calendar = Number.isSafeInteger(minutes) ? calendarFrom(settings, query) : null;
    const clock = calendar ? clockText(calendar, minutes) : '';
    let when = '';
    try { when = calendar ? heroDate(calendar, minutes) : ''; } catch { when = ''; }
    const placeName = text(state?.domains?.scene?.place?.name);
    const here = ask(query, 'atlas.here', {}, null);
    const [x, y] = coordsOf(query, here, placeName);
    // The atlas does not have a place the story has just named until the next send: its line is worked out from the name (atlas.line).
    const line = text(here?.line) || (placeName ? text(ask(query, 'atlas.line', { name: placeName }, '')) : '') || placeName;
    const weather = ask(query, 'scene.weather', {}, null);
    const you = ask(query, 'scene.you', {}, null);
    return {
        summary: summaryText([clock, line].filter(Boolean).join(', ')),
        when,
        place: cut(line, 80),
        region: cut(text(here?.region) || text(state?.domains?.scene?.place?.region), 80),
        coords: x && y ? `${x}, ${y}` : '',
        weather: isRecord(weather) ? cut(text(weather.text), WEATHER_CHARS) : '',
        // The Rank only where a pack gives the game one: Story Block answers `rankLabel` (its word for it) then, and no `rank` without it.
        rankLabel: isRecord(you) ? cut(text(you.rankLabel), RANK_LABEL_CHARS) : '',
        rank: isRecord(you) && text(you.rankLabel) ? cut(text(you.rank), YOU_CHARS) : '',
        wearing: isRecord(you) ? cut(text(you.wearing), YOU_CHARS) : '',
        condition: isRecord(you) ? cut(text(you.condition), YOU_CHARS) : '',
    };
}
