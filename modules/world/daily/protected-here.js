// World events, the daily step: whether a protected, living person lives at a place (spec §2: no placeStatus there from a template). Pure.

import { groupOf } from './geo-scope.js';
import { placeOf } from './cast-where.js';

/** Whether a protected, living person lives at the place or a district under it. */
export function protectedHere(ws, place) {
    const group = new Set(groupOf(ws.geo, place.name));
    return [...ws.people.values()].some(person => person.protected && ws.cast[person.id]?.died === undefined && group.has(placeOf(ws, person.id)));
}
