// Story Director v2, chronicle pick: resolves the tail's open events for the current reply.

import { isOpen, keptEvents, orderedEvents, surfacedOf } from '../domain.js';
import { TAIL_EVENTS, hashUnit, pickEvents } from './scoring.js';

const isInt = value => Number.isSafeInteger(value);

/** Whether `surfaced` is the pick for the reply being written now (`at`: the chat's length). */
export function pickFresh(surfaced, at) {
    if (!surfaced || !isInt(at) || !isInt(surfaced.at)) return false;
    // The chat holds the reply being swiped or regenerated, or not yet: `at` or `at + 1`.
    return at >= surfaced.at && at < surfaced.at + 2;
}

/**
 * The open events the tail shows, best first: all of them when there are three or fewer; the
 * recorded pick when it is this reply's (topped up when one of them has closed since); else the
 * pick made from the state with a hash of `rev` and each id.
 */
export function tailPick(chronicle, { at = null, rev = 0, near = () => 0 } = {}) {
    const open = orderedEvents(chronicle).filter(isOpen);
    if (!open.length) return [];
    const round = (chronicle.round ?? 0) + 1;
    const hashed = id => hashUnit(`${rev}:${id}`);
    if (open.length <= TAIL_EVENTS) return pickEvents(chronicle, { round, near, jitter: hashed });
    const surfaced = surfacedOf(chronicle);
    if (pickFresh(surfaced, at)) {
        // An event marked `keep` since the pick was made (or a pick made before it) still has its seat.
        const held = keptEvents(chronicle).map(event => event.id);
        const kept = [...held, ...surfaced.ids.filter(id => isOpen(chronicle.events?.[id]) && !held.includes(id))];
        if (kept.length >= TAIL_EVENTS) return kept.slice(0, TAIL_EVENTS);
        const more = pickEvents(chronicle, { round: surfaced.round, near, jitter: hashed, limit: open.length }).filter(id => !kept.includes(id));
        return [...kept, ...more].slice(0, TAIL_EVENTS);
    }
    return pickEvents(chronicle, { round, near, jitter: hashed });
}
