// Story Director v2, chronicle pick: event staleness scoring, deterministic hashing, and selection.

import { isOpen, keptEvents, orderedEvents, seenOf } from '../domain.js';

/** Events in the tail at most. */
export const TAIL_EVENTS = 3;
/** Picks since an event was last shown count up to this many. */
export const STALE_CAP = 8;

const isInt = value => Number.isSafeInteger(value);

/** A number in [0, 1) from `text` (FNV-1a, 32 bits): the same text always gives the same number. */
export function hashUnit(text) {
    let hash = 0x811c9dc5;
    for (const char of String(text)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash / 4294967296;
}

/**
 * The ids of the open events to show, best first: at most `limit`, the kept ones (`keep`) first. `round`
 * is the pick being made (`chronicle.round + 1`), `near(place)` from `nearness`, `jitter(id)` → [0, 1).
 */
export function pickEvents(chronicle, { round, near = () => 0, jitter = () => 0, limit = TAIL_EVENTS } = {}) {
    const seen = seenOf(chronicle);
    const scored = orderedEvents(chronicle).filter(isOpen).map(event => {
        const last = seen[event.id];
        const stale = isInt(last) ? Math.min(STALE_CAP, Math.max(0, round - last)) : STALE_CAP;
        return { id: event.id, score: stale + near(event.place) + jitter(event.id) };
    });
    scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    const held = keptEvents(chronicle).map(event => event.id);
    return [...held, ...scored.map(entry => entry.id).filter(id => !held.includes(id))].slice(0, limit);
}
