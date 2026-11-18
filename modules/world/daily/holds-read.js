// World events, the daily step: reading conditions (spec v0.10 §2): whether an entry is active (a timer not yet ended, an open
// setter, or an event hold), and whether a condition holds at a ref through the scope hierarchy and local clears. Pure (reads `ws`).

import { ancestors } from './geo-scope.js';

const keyOf = (name, ref) => `${name}@${ref}`;

/** Whether the entry is active at `minute`. */
export function entryActive(entry, minute) {
    if (!entry) return false;
    if (Array.isArray(entry.holds) && entry.holds.length) return true;
    return entry.fadesAt === null || entry.fadesAt > minute;
}

/** Whether `name` holds at `ref` at `minute`: there, or at a broader ref containing it, unless a local clear masks it on the way. */
export function conditionHolds(ws, name, ref, minute) {
    for (const level of ancestors(ws.geo, ref)) {
        const key = keyOf(name, level);
        if (ws.masks[key]) return false;
        if (entryActive(ws.table[key], minute)) return true;
    }
    return false;
}
