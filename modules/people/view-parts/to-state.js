// The people slice back to the sidecar's people keys (view.js, PEOPLE_KEYS), or null when the slice is malformed. Pure.

import { isPlain, list, stripVolatile } from './volatile.js';

// Block store keeps (records keyed by id, in order), and turns that slice back into the sidecar's people
// keys. NSD's history, rollback and scheduler keys are left out on purpose. Pure: no I/O, no host.
// `peopleState` turns the stored slice back into the people keys (PEOPLE_KEYS): the hydrate of src/adapter/people-sync.js uses it.
export const PEOPLE_KEYS = Object.freeze(['npcs', 'candidates', 'dismissed', 'userDismissedGroups', 'socialGraph', 'portraitAssets', 'turn']);

// A `+ npc` stub's `createdAt` is no clock: it is the reply's place (index + 1, npc-lines-parts/derived.js), and the fill-in finds the reply's new people by it
// (adapter/stub-fills.js newStubs, right after the reply's hydrate). Stripped like a clock, the cache never had it and no fill-in was ever queued (SOAKPEOPLE F46).
// It is kept one way only, store → cache (peopleState): the cache's own write (peopleView) still leaves it out, so the store holds what it held before.
// A clock stamp is milliseconds (far above this bound) and is still dropped.
const REPLY_STAMP_MAX = 1000000;

const isReplyStamp = value => Number.isInteger(value) && value >= 1 && value <= REPLY_STAMP_MAX;

const person = record => {
    const out = stripVolatile(record);
    return isPlain(out) && isPlain(record) && isReplyStamp(record.createdAt) ? { ...out, createdAt: record.createdAt } : out;
};

// view -> the sidecar's people keys (PEOPLE_KEYS only), or null when the view is malformed.
export function peopleState(view) {
    if (!isPlain(view) || view.v !== 1 || !Array.isArray(view.order) || !isPlain(view.npcs)) return null;
    const keys = Object.keys(view.npcs);
    if (view.order.length !== keys.length || !view.order.every(id => Object.prototype.hasOwnProperty.call(view.npcs, id))) return null;
    if (new Set(view.order).size !== view.order.length) return null;
    return {
        npcs: view.order.map(id => person(view.npcs[id])),
        candidates: stripVolatile(list(view.candidates)),
        dismissed: stripVolatile(list(view.dismissed)),
        userDismissedGroups: stripVolatile(list(view.userDismissedGroups)),
        socialGraph: stripVolatile(isPlain(view.socialGraph) ? view.socialGraph : {}),
        portraitAssets: stripVolatile(isPlain(view.portraitAssets) ? view.portraitAssets : {}),
        turn: Number.isFinite(view.turn) ? view.turn : 0,
    };
}
