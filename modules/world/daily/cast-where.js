// World events, the daily step: where a named person is at the tick (spec v0.14.6-v0.14.9 §8 Event moves, Latest base wins, from).
// The host hands in `positions` ({ [cast id]: { at, base } }, read from the cast store at the tick): `at` is where they are now,
// `base` their latest base (a story move, an event or Director move, a stays record), null while nothing has moved them from the
// pack start. A person the host does not list (pure tests, a chat with no cast store yet) is read from the step's own record, as
// before: displaced place, else home (permanent moves), else the pack's start/home base. Pure (reads and writes `ws.pos`).

import { resolveRef } from './geo.js';
import { groupOf } from './geo-scope.js';

const low = text => String(text ?? '').trim().toLowerCase();

/** Where a person is now. */
export function placeOf(ws, id) {
    const pos = ws.pos?.[id];
    if (pos) return pos.at ?? null;
    const row = ws.cast[id] ?? {};
    return row.displaced?.to ?? row.home ?? ws.people.get(id)?.home ?? null;
}

/** Their latest base, or null while nothing (no story move, no event move, no stays record) has moved them from the pack start. */
export function baseOf(ws, id) {
    const pos = ws.pos?.[id];
    if (pos) return pos.base ?? null;
    const row = ws.cast[id] ?? {};
    return row.displaced?.to ?? row.home ?? null;
}

/** Whether `place` (a place name) is in the group of `ref` (a place id or name: the place and the districts under it). */
export function inGroup(ws, place, ref) {
    if (!place) return false;
    const found = resolveRef(ws.geo, ref);
    if (found?.kind !== 'place') return false;
    const at = resolveRef(ws.geo, place);
    const name = at?.kind === 'place' ? at.name : place;
    return groupOf(ws.geo, found.name).some(member => low(member) === low(name));
}

/** A move by the step put them at `to` (their new base): later checks on the same tick read it. */
export function placeAt(ws, id, to) {
    if (ws.pos) ws.pos[id] = { at: to, base: to };
}
