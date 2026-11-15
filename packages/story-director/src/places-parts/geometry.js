// Story Director: coordinate distance, compass bearing and nearby-place queries.

import { DEFAULT_MAP, mapSettings } from './settings.js';
import { findBookPlace } from './book.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const EPSILON = 1e-9;

/** Straight-line km between two places with coordinates, or null. */
export function distanceKm(a, b, map = DEFAULT_MAP) {
    if (!a?.coords || !b?.coords) return null;
    const { kmPerUnit } = mapSettings(map);
    return Math.hypot(b.coords.x - a.coords.x, b.coords.y - a.coords.y) * kmPerUnit;
}

/** The compass direction from `a` to `b` ("NE"), or '' when they share a spot or lack coordinates. */
export function bearing(a, b, map = DEFAULT_MAP) {
    if (!a?.coords || !b?.coords) return '';
    const settings = mapSettings(map);
    const east = (b.coords.x - a.coords.x) * (settings.east === 'left' ? -1 : 1);
    const north = (b.coords.y - a.coords.y) * (settings.north === 'down' ? -1 : 1);
    if (Math.abs(east) < EPSILON && Math.abs(north) < EPSILON) return '';
    const degrees = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    return COMPASS[Math.round(degrees / 45) % 8];
}

/** Places with coordinates within `maxKm` in a straight line of `place` (nearest first), itself excluded. */
export function nearbyByCoords(book, place, { maxKm = 100, map = DEFAULT_MAP } = {}) {
    const here = typeof place === 'string' ? findBookPlace(book, place) : place;
    if (!here?.coords) return [];
    return (book?.places ?? [])
        .filter(other => other.key !== here.key && other.coords)
        .map(other => ({ place: other, km: distanceKm(here, other, map) }))
        .filter(entry => entry.km <= maxKm)
        .sort((a, b) => a.km - b.km)
        .map(entry => entry.place);
}
