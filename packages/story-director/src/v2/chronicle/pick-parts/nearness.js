// Story Director v2, chronicle pick: scene place lookup and atlas nearness scoring.

import { keyOf } from '../domain.js';

// "near Dragonfang", "the Old Weir": a place as the atlas would name it.
const placeKey = name => keyOf(name).replace(/^(?:near|around|outside|beyond|by|at|in|off|under|over)\s+/, '').replace(/^the\s+/, '');

function ask(query, name, args) {
    if (typeof query !== 'function') return null;
    try {
        return query(name, args) ?? null;
    } catch {
        return null;
    }
}

/** The scene's place name through the `scene.place` query, else Story Block's `scene` domain. */
export function scenePlaceOf(query, state) {
    const place = ask(query, 'scene.place', {}) ?? state?.domains?.scene?.place ?? null;
    return String(place?.name ?? '').trim();
}

/**
 * `near(place)` → 0…3: how near a place is to `here` (3 the same place, 2 a known route away,
 * 1 the same region, 0 otherwise or unknown). The atlas's `atlas.routes` and `atlas.place`
 * queries are asked once, and only when an event has a place.
 */
export function nearness(query, here) {
    const at = placeKey(here);
    if (!at) return () => 0;
    let links = null;
    let region;
    const regions = new Map();
    const regionOf = name => {
        const key = placeKey(name);
        if (!regions.has(key)) regions.set(key, keyOf(ask(query, 'atlas.place', { name })?.region ?? ''));
        return regions.get(key);
    };
    return place => {
        const key = placeKey(place);
        if (!key) return 0;
        if (key === at) return 3;
        links ??= new Set((ask(query, 'atlas.routes', { place: here }) ?? []).map(route => placeKey(route?.otherName)).filter(Boolean));
        if (links.has(key)) return 2;
        region ??= regionOf(here);
        return region && regionOf(place) === region ? 1 : 0;
    };
}
