// Determines whether an atlas trip is over and where a new trip starts.

import { parseLocation } from '../../places.js';
import { cleanName, keyOf } from '../domain.js';
import { DAY } from './shared-constants.js';
import { nodesOf, positionOf, tripOf } from './state.js';

// How long after the arrival the story may leave the destination unwritten before the trip counts as over (see isOver).
const ARRIVED_GRACE = 3 * DAY;

/**
 * Whether the trip is over for the story: it has arrived and {{user}}'s place is no longer one the trip names (the story moved on), or it is
 * a place the trip names other than the destination ARRIVED_GRACE or more after the arrival (the party went back the way it came; the
 * narrator has had that long to write the arrival). At the destination the arrival stays until the story moves on.
 */
export function isOver(trip, now, here) {
    if (!positionOf(trip, now).arrived) return false;
    const key = keyOf(parseLocation(here).name);
    if (!key) return false;
    if (!nodesOf(trip).some(name => keyOf(name) === key)) return true;
    const final = trip.legs.at(-1);
    return keyOf(final.to) !== key && now >= final.arrive + ARRIVED_GRACE;
}

/** Where a new trip starts from, given the head state: `{ node: name }` or `{ road: { from, to, km, kind, along } }` (names), or null. */
export function startOf(atlas, now, here) {
    const trip = Number.isSafeInteger(now) ? tripOf(atlas) : null;
    if (trip && !isOver(trip, now, here)) {
        const pos = positionOf(trip, now);
        if (pos.mid) return { road: { from: pos.leg.from, to: pos.leg.to, km: pos.leg.km, kind: pos.leg.kind, along: pos.along } };
        if (pos.node) return { node: pos.node };
    }
    const name = cleanName(parseLocation(here).name);
    return name ? { node: name } : null;
}
