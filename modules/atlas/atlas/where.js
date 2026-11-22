// Where a place lies, for the narrator's lines: the point the code can vouch for, the map's km per unit, and the compass words between two points.

import { DEFAULT_MAP, bearing, mapSettings } from '../places.js';

const WORDS = Object.freeze({ N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' });
const finite = place => Number.isFinite(place?.x) && Number.isFinite(place?.y);

/**
 * The point `{ x, y }` of a joined-world place (world.js) the code can vouch for, or null: a pack's, the reader's, one the story told
 * (`+ landmark … | at: 12 km north of …`, a route's `way:`), or one the map set beside the town it is in (a town whose own point is vouched
 * for). A point the map only guessed (`auto` with no parent: the middle of the region, or beside the last place) is not, so no compass
 * word is made from it. `packHas(name)`: whether a pack gives that place coordinates (they win over a guessed point, world.js).
 */
export function trustedPoint(place, { atlas, world, packHas = () => false } = {}, depth = 0) {
    if (!finite(place)) return null;
    const own = place.atlasId ? atlas?.places?.[place.atlasId] : null;
    if (!own?.auto || packHas(place.name) || (place.aliases ?? []).some(packHas)) return { x: place.x, y: place.y };
    // (as deep as world.js follows a chain of auto-placed parents)
    const up = own.parent && depth <= 3 ? world?.find?.(own.parent) : null;
    return up && up.id !== place.id && trustedPoint(up, { atlas, world, packHas }, depth + 1) ? { x: place.x, y: place.y } : null;
}

/**
 * A pack gives each road its length in km but no map scale: the median of km ÷ straight distance, less the road factor (roads wind), is the
 * map's km per unit; null with fewer than three measured roads.
 */
export function roadScale(world, roadFactor = 1.25) {
    const byId = new Map(world.places.map(place => [place.id, place]));
    const ratios = [];
    for (const route of world.routes) {
        const a = byId.get(route.from), b = byId.get(route.to);
        const d = a && b && Number.isFinite(a.x) && Number.isFinite(b.x) ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
        if (d > 0 && Number(route.km) > 0) ratios.push(Number(route.km) / d);
    }
    if (ratios.length < 3) return null;
    ratios.sort((x, y) => x - y);
    return Math.round((ratios[ratios.length >> 1] / (roadFactor > 0 ? roadFactor : 1)) * 100) / 100;
}

/**
 * The km per map unit the narrator's lines use: the pack's roads' scale when they give one (the setting's default of 1 would put
 * Auvoth 5 km from Bluewatch, whose road is 70 km), else the reader's Km per map unit when it is not the default; null when neither
 * says (the lines then give directions without km).
 */
export function kmScale(world, map) {
    const settings = mapSettings(map);
    return roadScale(world, settings.roadFactor) ?? (settings.kmPerUnit !== DEFAULT_MAP.kmPerUnit ? settings.kmPerUnit : null);
}

/** The compass words ("north-east") from point `a` to point `b` under the reader's north/east setting, or '' (the same spot, or no point). */
export function compassWords(a, b, map) {
    if (!a || !b) return '';
    return WORDS[bearing({ coords: a }, { coords: b }, map)] ?? '';
}
