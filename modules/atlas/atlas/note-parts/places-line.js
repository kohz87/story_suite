// The narrator's "Where places lie" line: direction and distance, as the crow flies, from the scene's place to the places the reader's
// message and the last reply name, then to the nearest city or capital each way (owner, 22 Nov: the narrator sent the road to Auvoth
// "east" from Bluewatch; Auvoth lies west). Only points the code can vouch for (where.js trustedPoint) are used.

import { compassWords } from '../where.js';

/** The line's room in tokens (characters / 4), after the routes in the atlas's tail. */
export const PLACES_TAIL_BUDGET = 100;

const MAJOR = new Set(['capital', 'city']);
// Text folded for finding a name in it: lower case, every run of other characters one space.
const fold = text => ` ${String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

/** "about 70 km", rounded as a traveller would say it (to 1 km under 20, 5 under 100, 10 under 1,000, then 50). */
export function aboutKm(km) {
    const step = km < 20 ? 1 : km < 100 ? 5 : km < 1000 ? 10 : 50;
    return `about ${(Math.max(1, Math.round(km / step) * step)).toLocaleString('en-US')} km`;
}

// The places `said` names, in the order it first names them: a place's name or one of its other names, whole words, at least 3 letters.
// A town's part ("Shackles City / Veil Market") is not looked for: the town is.
function namedIn(said, places) {
    const text = fold(said);
    if (!text.trim()) return [];
    const found = [];
    for (const place of places) {
        if (place.name.includes('/')) continue;
        let first = -1;
        for (const name of [place.name, ...(place.aliases ?? [])]) {
            const folded = fold(name);
            if (folded.trim().length < 3) continue;
            const at = text.indexOf(folded);
            if (at >= 0 && (first < 0 || at < first)) first = at;
        }
        if (first >= 0) found.push({ place, first });
    }
    return found.sort((a, b) => a.first - b.first).map(entry => entry.place);
}

/**
 * "Where places lie from Bluewatch Village, as the crow flies: Shackles City about 1,650 km south-west · Auvoth about 70 km west." or ''.
 * `here`: the scene's place name; `said`: the reader's message and the last reply; `pointOf(place)`: its vouched-for point or null;
 * `scale`: km per map unit; `maxChars`: the line's room. Named places first, then the nearest city or capital in each of the eight
 * directions on the scene's plane, nearest first. A hidden place and one within a kilometre (the same town) are left out.
 */
export function placesLine(world, here, { said = '', map, pointOf, scale = 1, maxChars = 400 } = {}) {
    const at = world.find(here);
    const up = at?.parent ? world.find(at.parent) : null;
    const from = at ? pointOf(at) ?? (up ? pointOf(up) : null) : null;
    if (!from) return '';
    const layer = at.layer || up?.layer || '';
    const others = world.places.filter(place => !place.hidden && place.id !== at.id && place.id !== up?.id);
    // Named places on any plane (the reader or the story asked about them); the cities each way only on the scene's own plane.
    const sameLayer = others.filter(place => (place.layer || '') === layer);
    const item = place => {
        const point = pointOf(place);
        if (!point) return null;
        const km = Math.hypot(point.x - from.x, point.y - from.y) * scale;
        const way = compassWords(from, point, map);
        return km >= 1 && way ? { place, km, way, text: `${place.name} ${aboutKm(km)} ${way}` } : null;
    };
    const named = namedIn(said, others).map(item).filter(Boolean);
    const shown = new Set(named.map(entry => entry.place.id));
    const nearestEachWay = new Map();
    for (const place of sameLayer) {
        if (!MAJOR.has(String(place.kind ?? '').toLowerCase()) || shown.has(place.id)) continue;
        const entry = item(place);
        if (!entry) continue;
        const best = nearestEachWay.get(entry.way);
        if (!best || entry.km < best.km || (entry.km === best.km && entry.place.name < best.place.name)) nearestEachWay.set(entry.way, entry);
    }
    const majors = [...nearestEachWay.values()].sort((a, b) => a.km - b.km || a.place.name.localeCompare(b.place.name));
    const head = `Where places lie from ${at.name}, as the crow flies: `;
    let text = '';
    for (const entry of [...named, ...majors]) {
        const next = text ? `${text} · ${entry.text}` : entry.text;
        if ((head + next + '.').length > maxChars) break;
        text = next;
    }
    return text ? `${head}${text}.` : '';
}
