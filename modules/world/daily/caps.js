// World events, the daily step: the caps and pacing of majors (spec v0.10 §3 Caps and pacing). At most 2 active majors per
// realm (the Wilds is one virtual realm) and 4 in the world; at most 1 new major per realm per 45 × tempo days. An event naming
// several realms takes a slot in each and counts once in the world; one that names no realm checks only the world cap.
// A set-in-motion event fires over the caps but still occupies its slots and resets its realms' timers. Pure (on `ws`).

import { scaleDays } from './durations.js';
import { realmsOf } from './geo-scope.js';
import { placesFor } from './placement.js';

export const CAPS = Object.freeze({ perRealm: 2, world: 4, newMajorDays: 45 });

/** The realms an event takes slots in: the realm of the place it is bound to, else its `where` refs, else the realms of the places its `where` kinds (and region / realm) match. */
export function eventRealms(ws, def, bind) {
    if (bind?.place) return [bind.realm].filter(Boolean);
    if (def.where?.kinds?.length || def.where?.region || def.where?.realm) return [...new Set(placesFor(ws, def.where, 0).map(({ place }) => place.realm))].sort();
    return realmsOf(ws.geo, def.where?.refs ?? []);
}

/** Why a major cannot start today (a sentence), or '' when the caps allow it. */
export function capBlock(ws, realms, day) {
    // A running generated arc with a major step holds one slot in its realm for as long as it runs (arc-day.js).
    const arcs = Object.values(ws.arcs ?? {}).filter(arc => arc.state === 'running' && arc.major).map(arc => ({ realms: [arc.realm] }));
    const active = [...Object.values(ws.events).filter(row => row.state === 'active' && row.major), ...arcs];
    if (active.length >= CAPS.world) return `the world already has ${CAPS.world} active major events`;
    const wait = scaleDays(CAPS.newMajorDays, ws.tempo);
    for (const realm of realms) {
        if (active.filter(row => (row.realms ?? []).includes(realm)).length >= CAPS.perRealm) return `${realm} already has ${CAPS.perRealm} active major events`;
        const last = ws.lastMajor[realm];
        if (Number.isInteger(last) && day - last < wait) return `${realm} had a new major event less than ${wait} days ago`;
    }
    return '';
}

/** A major started today in `realms`: their 45-day timers restart (its slots are its Active row's `realms`). */
export function takeSlots(ws, realms, day) {
    for (const realm of realms) ws.lastMajor[realm] = day;
}
