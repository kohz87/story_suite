// A new place the story tells the way to ("Fernhollow lies a day north"): its `way:` on the route line, or `at: 12 km north of Place` on
// its landmark line, puts it on the map from the place it is told from, so later lines give its direction from the code (owner, 22 Nov:
// "the direction to a new place should be post narrative: the narrative says how far and which way, then it gets saved"). The point is
// worked out when the line is read, from the line, the map so far, the pack's roads and the reader's map settings, and stored: a reload, a
// middle delete or a rebuild replays the stored point. A swipe or a Re-read reads the line again, so a map setting changed in between (north
// flipped) gives the point under the new setting, as a trip's plan does (trip-capture.js). A told point whose anchor's reply is later deleted
// keeps the point it was given.

import { DEFAULT_PACES, MODERN_PACES, mapSettings } from '../../places.js';
import { round3 } from '../domain.js';
import { packPlace, worldOf } from '../world.js';
import { kmScale, trustedPoint } from '../where.js';

// The eight ways as (east, north) steps; their words, hyphen and space forms and letters.
const STEPS = { n: [0, 1], ne: [1, 1], e: [1, 0], se: [1, -1], s: [0, -1], sw: [-1, -1], w: [-1, 0], nw: [-1, 1] };
const NAMES = { north: 'n', south: 's', east: 'e', west: 'w' };

/** The compass key ('ne') a `way:` value names ("north-east", "northeast", "north east", "NE", "to the north"), or null. */
export function wayOf(text) {
    const words = String(text ?? '').toLowerCase().replace(/^\s*(?:to\s+the\s+|the\s+)/, '').replace(/[-\s]+/g, ' ').trim();
    if (STEPS[words.replace(/ /g, '')]) return words.replace(/ /g, '');
    const parts = words.replace(/^(north|south)(east|west)$/, '$1 $2').split(' ');
    if (parts.length > 2 || !parts.every(part => NAMES[part])) return null;
    const key = parts.map(part => NAMES[part]).join('');
    return STEPS[key] ? key : null;
}

/** `at: 12 km north-east of Bluewatch Village` → `{ km: 12, way: 'ne', of: 'Bluewatch Village' }`, or null. */
export function toldAt(text) {
    const match = String(text ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*km\s+(.+?)\s+of\s+(.+)$/i);
    const way = match ? wayOf(match[2]) : null;
    const km = match ? Number(match[1]) : 0;
    return way && km > 0 && km <= MAX_TOLD_KM && match[3].trim() ? { km, way, of: match[3].trim() } : null;
}

/** The most km the story can tell a new place away (more is a slip: the place stays unplaced, as with a way the code cannot read). */
const MAX_TOLD_KM = 5000;

/**
 * km a route's time stands for (`era`: the map's). Pre-modern: a day's pace by its kind (river by boat, sea by ship, the rest on foot), an
 * hour a fifth of a day's. Modern: km an hour by its kind (road by car, rail by train, river by ferry, sea by ship, a trail on foot), a day
 * eight hours of it.
 */
export function routeKm(route, era = 'pre-modern') {
    const kind = String(route?.kind ?? '');
    const days = Number(route?.days) || 0, hours = Number(route?.hours) || 0;
    let km;
    if (era === 'modern') {
        const hourly = /sea|ocean/.test(kind) ? MODERN_PACES.ship : /river|canal|lake|ferry/.test(kind) ? MODERN_PACES.ferry : /rail|train/.test(kind) ? MODERN_PACES.train
            : /trail|path|foot/.test(kind) ? MODERN_PACES.foot : MODERN_PACES.car;
        km = (days * 8 + hours) * hourly;
    } else {
        const day = /sea|ocean/.test(kind) ? DEFAULT_PACES.ship : /river|canal|lake/.test(kind) ? DEFAULT_PACES.boat : DEFAULT_PACES.foot;
        km = days * day + hours * day / 5;
    }
    return km > 0 ? km : null;
}

/**
 * Puts atlas place `place` (a draft) `km` along the road (straight line: km ÷ the road factor; `straight`: km is already straight) the
 * `way` from atlas or pack place `from` (a name), when the story may: `place` is no pack's and has no point the code vouches for (none,
 * or the map's guess), and `from` has one. Its point is then the story's (no `auto` mark). `back`: the way is from `place` to `from`
 * (a route line's first place is the new one). Returns whether it was placed.
 */
export function placeTold(ctx, atlas, pack, place, { from, way, km, straight = false, back = false }) {
    if (!place || !STEPS[way] || !(km > 0 && km <= MAX_TOLD_KM) || packPlace(pack, place.name)) return false;
    const settings = typeof ctx?.settings === 'function' ? ctx.settings() : {};
    const map = mapSettings(settings?.map);
    const world = worldOf(atlas, pack);
    const packHas = name => Number.isFinite(packPlace(pack, name)?.x);
    const vouched = entry => trustedPoint(entry, { atlas, world, packHas });
    const self = world.find(place.id);
    const origin = world.find(from);
    const start = origin && origin.id !== self?.id ? vouched(origin) : null;
    if (!start || (self && vouched(self))) return false;
    // (no scale the map can vouch for: the setting's, so the story's own places still lie the km it told from one another)
    const units = (straight ? km : km / map.roadFactor) / (kmScale(world, map) ?? map.kmPerUnit);
    const [east, north] = STEPS[way].map(step => (back ? -step : step));
    const length = Math.hypot(east, north);
    place.x = round3(start.x + (east / length) * units * (map.east === 'left' ? -1 : 1));
    place.y = round3(start.y + (north / length) * units * (map.north === 'down' ? -1 : 1));
    delete place.auto;
    return true;
}
