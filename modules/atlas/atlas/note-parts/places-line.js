// The narrator's "Where places lie" line: direction and distance, as the crow flies, from the scene's place to the places the reader's
// message and the last reply name, then to the nearest city or capital each way (owner, 22 Nov: the narrator sent the road to Auvoth
// "east" from Bluewatch; Auvoth lies west). Only points the code can vouch for (where.js trustedPoint) are used.

import { compassWords } from '../where.js';

/** The line's room in tokens (characters / 4), after the routes in the atlas's tail. */
export const PLACES_TAIL_BUDGET = 100;

const MAJOR = new Set(['capital', 'city']);
// Text folded for finding a name in it: every run of characters other than letters and digits one space; the case is kept, so a name counts
// only as written with its capital ("we rest at dawn" is not the village Rest).
const fold = text => ` ${String(text ?? '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const proper = name => /^\p{Lu}/u.test(name.trim());

/** "about 70 km", rounded as a traveller would say it (to 1 km under 20, 5 under 100, 10 under 1,000, then 50). */
export function aboutKm(km) {
    const step = km < 20 ? 1 : km < 100 ? 5 : km < 1000 ? 10 : 50;
    return `about ${(Math.max(1, Math.round(km / step) * step)).toLocaleString('en-US')} km`;
}

// The places `said` names, in the order it first names them: a place's name or one of its other names, whole words with the capital, at least
// 3 letters; an other name two places share names neither. A town's part ("Shackles City / Veil Market") is not looked for: the town is.
function namedIn(said, places) {
    const text = fold(said);
    if (!text.trim()) return [];
    const owners = new Map();
    for (const place of places) for (const alias of new Set((place.aliases ?? []).map(fold))) owners.set(alias, (owners.get(alias) ?? 0) + 1);
    const found = [];
    for (const place of places) {
        if (place.name.includes('/')) continue;
        let first = -1;
        for (const name of [place.name, ...(place.aliases ?? [])]) {
            const folded = fold(name);
            if (folded.trim().length < 3 || !proper(name) || (name !== place.name && owners.get(folded) > 1)) continue;
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
 * `scale`: km per map unit, or null (no scale to vouch for: directions without km); `maxChars`: the line's room. A named place on another
 * plane says so ("Deepwalker Hall (underground)"). Named places first, then the nearest city or capital in each of the eight
 * directions on the scene's plane, nearest first. A hidden place and one within a kilometre (the same town) are left out.
 */
export function placesLine(world, here, { said = '', map, pointOf, scale = null, maxChars = 400 } = {}) {
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
        const units = Math.hypot(point.x - from.x, point.y - from.y);
        const km = scale ? units * scale : null;
        const way = compassWords(from, point, map);
        if (!way || (km !== null && km < 1)) return null;
        const plane = (place.layer || '') !== layer ? ` (${place.layer || 'surface'})` : '';
        return { place, km: km ?? units, way, text: `${place.name}${plane} ${km === null ? '' : `${aboutKm(km)} `}${way}` };
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
    const majors = [...nearestEachWay.values()].sort((a, b) => a.km - b.km || (a.place.name < b.place.name ? -1 : a.place.name > b.place.name ? 1 : 0));
    const head = `Where places lie from ${at.name}, as the crow flies: `;
    let text = '';
    for (const entry of [...named, ...majors]) {
        const next = text ? `${text} · ${entry.text}` : entry.text;
        if ((head + next + '.').length > maxChars) break;
        text = next;
    }
    return text ? `${head}${text}.` : '';
}
