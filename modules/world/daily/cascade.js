// World events, the daily step: what ends an event before it fires (spec v0.10 §3): pre-emption, the chain cascade (an event whose
// only path waited on a Lapsed or Replaced event goes the same way), and the anchor its window opens on. Pure (reads `ws`).

import { anchorDay, anchorHolds, occurrences } from './anchors.js';
import { anchorString, isConditionEntry } from './grammar.js';

/** The terminal state of the event an anchor waits on, when it can never fire now: 'lapsed' | 'replaced' | null. */
function deadPath(ws, text) {
    if (isConditionEntry(text)) return null;
    const anchor = anchorString(text);
    if (!anchor || !['stage', 'fired', 'ended'].includes(anchor.kind)) return null;
    const row = ws.events[anchor.id];
    if (!row || (row.state !== 'lapsed' && row.state !== 'replaced')) return null;
    return occurrences(ws, anchor).length ? null : row.state;
}

/**
 * The cascade (§3): an event whose only path waited on a Lapsed or Replaced event goes the same way. A `requires` entry on a dead
 * event kills it; `requires_any` kills it only once every path is dead ('replaced' if any dead path was Replaced). Null: alive.
 */
export function cascadeState(ws, def) {
    for (const text of def.requires ?? []) {
        const dead = deadPath(ws, text);
        if (dead) return dead;
    }
    const any = def.requiresAny ?? [];
    if (!any.length) return null;
    const dead = any.map(text => deadPath(ws, text));
    if (dead.some(state => state === null)) return null;
    return dead.includes('replaced') ? 'replaced' : 'lapsed';
}

/** Whether any `pre_empted_by` anchor has happened by `day`. */
export const preEmpted = (ws, def, day) => (def.preEmptedBy ?? []).some(text => anchorHolds(ws, text, day));

/** The day the event's window opens by its `after` anchor (first or latest occurrence by anchor_mode), or null while it has not happened. */
export const windowAnchor = (ws, def) => anchorDay(ws, def.window.after, def.anchorMode);
