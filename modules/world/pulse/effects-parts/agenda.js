// Works out an agenda's step progress fields and the atlas place a text names.

import { ask } from '../../../time/tracker/scene.js';
import { plainSlot } from '../tables.js';
import { isInt } from './shared-guards.js';
import { NAME_MAX } from './shared-names.js';

const segments = text => String(text ?? '').split(/\s*(?:;|→|->)\s*/).filter(Boolean).length;

/**
 * The extra fields an agenda line leaves: `stepAt` (which step it is on, from 1), `stepOf` (how many, from the agenda's own `then` list
 * "a; b; c" or kept once set) and `stepSince` (the story minute the step began), when `now` or `then` moved; `where` (the atlas place
 * `now` names, given by the caller). The names never meet the narrator's own `step` field. `before` is the thread's fields (null: new).
 * Returns the fields to merge (all text), or null for no change. Old agendas without them stay valid.
 */
export function agendaProgress(before, after, { minutes = null, where = '' } = {}) {
    const moved = !before || before.now !== after.now || before.then !== after.then;
    const patch = {};
    if (moved && (after.now || after.then)) {
        const of = Number(after.stepOf) > 0 ? Number(after.stepOf) : (segments(after.then) ? segments(after.then) + 1 : 0);
        const base = before ? (Number(before.stepAt) || 1) + 1 : 1;
        const at = of ? Math.min(of, base) : base;
        if (String(at) !== after.stepAt) patch.stepAt = String(at);
        if (of && String(of) !== after.stepOf) patch.stepOf = String(of);
        if (isInt(minutes) && String(minutes) !== after.stepSince) patch.stepSince = String(minutes);
    }
    if (plainSlot(where, NAME_MAX) && where !== after.where) patch.where = plainSlot(where, NAME_MAX);
    return Object.keys(patch).length ? patch : null;
}

/** The atlas place `text` names (its name), or ''. `query`: a ctx's or a view's. */
export const placeNamed = (query, text) => (plainSlot(text, NAME_MAX) ? plainSlot(ask(query, 'atlas.place', { name: plainSlot(text, NAME_MAX) }, null)?.name, NAME_MAX) : '');
