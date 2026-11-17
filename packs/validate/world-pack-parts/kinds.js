// The job: checking the two kind maps (`placeKinds`, `routeKinds`) and that every place and route kind a pack uses is mapped or an engine class.

import { PLACE_CLASSES, ROUTE_CLASSES, WORLD_LIMITS } from '../../limits.js';
import { isObject } from '../core.js';

/** `{ "fort": "outpost", … }` → a plain copy. Refuses a non-class value and a map that is not an object. Returns the map or null. */
function checkKindMap(value, kind, classes, add) {
    const path = `content.${kind}`;
    if (!isObject(value)) { add('BAD_CONTENT', path, `${path} must be an object mapping each kind to an engine class, like { "fort": "${classes[3]}" }.`); return null; }
    const entries = Object.entries(value);
    if (entries.length > WORLD_LIMITS.kinds) { add('BAD_CONTENT', path, `${path} maps at most ${WORLD_LIMITS.kinds} kinds.`); return null; }
    const out = {};
    let ok = true;
    for (const [word, mapped] of entries) {
        if (!word.trim() || word.length > 40) { ok = false; add('BAD_RECORD', `${path}.${word.slice(0, 20)}`, `${path}: a kind is a word of 1 to 40 characters.`); continue; }
        if (!classes.includes(mapped)) { ok = false; add('BAD_RECORD', `${path}.${word}`, `${path}: "${word}" maps to "${String(mapped)}", which is not an engine class (${classes.join(', ')}).`); continue; }
        out[word] = mapped;
    }
    return ok ? out : null;
}

export const placeKindMap = (value, add) => checkKindMap(value, 'placeKinds', PLACE_CLASSES, add);
export const routeKindMap = (value, add) => checkKindMap(value, 'routeKinds', ROUTE_CLASSES, add);

/** The engine class of a place or route kind: its mapping, or itself when it is a class; null when it is neither (an empty place kind is unmapped, not refused). */
export const classOfKind = (kind, map, classes) => (typeof kind === 'string' && kind && map && Object.hasOwn(map, kind) ? map[kind] : classes.includes(kind) ? kind : null);

/** Every kind a place or route uses is mapped or a class (the places and routes are the normalized ones). */
export function checkKindsUsed(places, routes, { placeKinds, routeKinds }, add) {
    places.forEach((place, index) => {
        if (place.kind && classOfKind(place.kind, placeKinds, PLACE_CLASSES) === null) add('UNKNOWN_REF', `content.places[${index}].kind`, `Place "${place.name}": the kind "${place.kind}" is not in placeKinds and is not an engine class (${PLACE_CLASSES.join(', ')}).`);
    });
    routes.forEach((route, index) => {
        if (classOfKind(route.kind, routeKinds, ROUTE_CLASSES) === null) add('UNKNOWN_REF', `content.routes[${index}].kind`, `Route "${route.from}" to "${route.to}": the kind "${route.kind}" is not in routeKinds and is not an engine class (${ROUTE_CLASSES.join(', ')}).`);
    });
}
