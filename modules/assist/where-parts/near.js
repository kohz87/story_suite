// What the extractor is told of the scene's place: the place now and the known names nearest it, with the story's time.

import { clip, fold } from './shared-text.js';
import { knownPlace } from './places.js';

// How many known place names the extractor is told (the nearest first), and the longest name told.
export const MAX_NEAR = 20;
export const NAME_CHARS = 80;

/**
 * What the extractor is told: `{ here, near, time }`. `here`: the scene's place `{ name, kind, region }` (or null); `near`:
 * the map's place names, those nearest the scene's place first (by the map's coordinates when both have them, else the ones
 * in its region, else the map's order), at most `cap`, never the place itself; `time`: the story's date and time as text.
 */
export function whereNow({ here = null, places = [], time = '' } = {}, { cap = MAX_NEAR } = {}) {
    const name = typeof here?.name === 'string' ? here.name.trim() : '';
    const mine = name ? knownPlace(places, name) : null;
    const region = fold(here?.region || mine?.region || '');
    const distance = place => (mine && mine.x !== null && mine.y !== null && place.x !== null && place.y !== null ? Math.hypot(place.x - mine.x, place.y - mine.y) : Infinity);
    const ranked = places.filter(place => place !== mine && fold(place.name) !== fold(name))
        .map((place, at) => ({ place, at, far: distance(place), same: region && fold(place.region) === region ? 0 : 1 }))
        .sort((a, b) => (a.far - b.far) || (a.same - b.same) || (a.at - b.at));
    return {
        here: name ? { name: clip(name, NAME_CHARS), kind: clip(here?.kind, 40), region: clip(here?.region, NAME_CHARS) } : null,
        near: ranked.slice(0, Math.max(0, cap)).map(item => clip(item.place.name, NAME_CHARS)),
        time: clip(time, 80),
    };
}
