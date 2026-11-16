// Chronicle's factions list order and the pruning of events past the caps.

import { MAX_EVENTS, MAX_RESOLVED } from './limits-caps.js';
import { keyOf } from './names.js';
import { isOpen } from './order.js';
import { forgetSeen } from './state.js';

/** Factions by name, then id. */
export function orderedFactions(chronicle) {
    return Object.values(chronicle?.factions ?? {}).sort((a, b) => keyOf(a.name).localeCompare(keyOf(b.name)) || (a.id < b.id ? -1 : 1));
}

/**
 * Keeps the caps after a change (on a draft): resolved events beyond MAX_RESOLVED, then beyond
 * MAX_EVENTS in all, go oldest first (by the receipt that last changed them, then id). Returns
 * the names pruned.
 */
export function prune(chronicle) {
    const resolved = Object.values(chronicle.events).filter(event => !isOpen(event))
        .sort((a, b) => (a.rev ?? 0) - (b.rev ?? 0) || (a.id < b.id ? -1 : 1));
    const gone = [];
    let total = Object.keys(chronicle.events).length;
    let kept = resolved.length;
    for (const event of resolved) {
        if (kept <= MAX_RESOLVED && total <= MAX_EVENTS) break;
        delete chronicle.events[event.id];
        forgetSeen(chronicle, event.id);
        gone.push(event.name);
        kept -= 1;
        total -= 1;
    }
    return gone;
}
