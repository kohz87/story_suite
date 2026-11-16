// Atlas route ordering, lookup between places, and duration conversion.

import { orderedPlaces } from './places.js';

/** Routes in a fixed order: by the places' order, then kind, then id. */
export function orderedRoutes(atlas) {
    const rank = new Map(orderedPlaces(atlas).map((place, index) => [place.id, index]));
    const at = id => rank.get(id) ?? Infinity;
    return Object.values(atlas?.routes ?? {}).sort((a, b) => Math.min(at(a.from), at(a.to)) - Math.min(at(b.from), at(b.to))
        || Math.max(at(a.from), at(a.to)) - Math.max(at(b.from), at(b.to)) || a.kind.localeCompare(b.kind) || (a.id < b.id ? -1 : 1));
}

/** The routes between two place ids, either way round. */
export const routesBetween = (atlas, a, b) => orderedRoutes(atlas).filter(route => (route.from === a && route.to === b) || (route.from === b && route.to === a));

/** A route's time in hours (days count 24), or null when the story gave none. */
export function routeHours(route) {
    if (!route || (route.days === undefined && route.hours === undefined)) return null;
    return (route.days ?? 0) * 24 + (route.hours ?? 0);
}
