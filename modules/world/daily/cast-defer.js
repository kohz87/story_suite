// World events, the daily step: deferred displacements (spec v0.14.5 §8 With You, ruling 33; `from` re-checked, ruling 35). A move or
// an evacuation that found the person with You left `deferred` { to, by, until, title, routine?, from? }. At the first tick they are
// no longer with You it applies if the event still holds it (until "end": the event is Active; "cleared:<condition>@<ref>": that
// condition is still active; "permanent": always) and, with a place `from`, if they are still in that place's group; otherwise the
// record is dropped and nothing happens (logged for the Inspector). Pure (on `ws`).

import { displace } from './cast.js';
import { inGroup, placeOf } from './cast-where.js';
import { entryActive } from './holds-read.js';

const DAY = 1440;

function stillHolds(ws, deferred, minute) {
    if (deferred.until === 'permanent') return true;
    if (deferred.until === 'end') return ws.events[deferred.by]?.state === 'active';
    if (deferred.until.startsWith('cleared:')) return entryActive(ws.table[deferred.until.slice('cleared:'.length)], minute);
    return false;
}

/** On `day`: every deferred move of someone no longer with You applies or is dropped. */
export function applyDeferred(ws, day) {
    for (const id of Object.keys(ws.cast).sort()) {
        const deferred = ws.cast[id].deferred;
        if (!deferred || ws.withYou.has(id)) continue;
        const person = ws.people.get(id);
        const fromOk = !deferred.from || deferred.from === 'anywhere' || inGroup(ws, placeOf(ws, id), deferred.from);
        if (!person || ws.cast[id].died !== undefined || !stillHolds(ws, deferred, day * DAY) || !fromOk) {
            const { deferred: _gone, ...rest } = ws.cast[id];
            ws.cast[id] = rest;
            ws.log.push({ kind: 'deferred-dropped', key: id, by: deferred.by, day, why: fromOk ? 'no longer holds' : `not in ${deferred.from}` });
            continue;
        }
        displace(ws, person, deferred.to, { until: deferred.until, routine: deferred.routine ?? '', title: deferred.title ?? deferred.by }, day, deferred.by);
    }
}
