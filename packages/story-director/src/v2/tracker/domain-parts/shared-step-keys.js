// Story Director v2, tracker part (domain): the step trail's size limits, key rule and order, shared by its writer and its validator.

import { REPLY_KEY, countOf } from '../../reply-keys.js';

/** Entries the writer keeps (capture-parts/step-trail.js), the oldest going first. */
export const STEP_KEPT = 400;

/**
 * The most the validator lets the map hold. Replay can hold more than the live cap: a Re-read of an edited
 * reply may add more entries than it did the first time, while a later reply's stored prune of a key that is
 * gone is skipped and its adds still go in (the same headroom as the problems list).
 */
export const STEP_CEILING = 2 * STEP_KEPT;

/** A step's key: the shared reply key (`<sid>.<n>`, `<sid>:<receipt id>.<n>`, or an older `<rev>.<n>` / `r<rev>.<n>`; reply-keys.js). */
export const STEP_KEY = REPLY_KEY;

// The record a key belongs to: what comes before its `:` (a receipt's write) or its last `.` (the count).
const recordOf = key => key.split(':')[0].replace(/\.\d+$/, '');

/**
 * The map's keys in story order. By the writing reply's turn (`turn`, `director.turn.n`) first: stored values never move, so a
 * middle delete keeps them in order. Within a turn, the reply placed earlier in the chat (`place`, the carrier index when written: a
 * later reply's stored place is never below the Re-read one's) goes first (two replies share a turn only when a Re-read gives
 * Director lines to a reply that had none). A reply is placed by the smallest place its own entries carry, and its entries go by
 * their number whatever their place: a Continue written after an earlier message was deleted (or a swipe or Re-read moved the
 * count) carries a lower place than the reply's first steps, and must not come before them.
 */
export const stepOrder = map => {
    const num = value => (Number.isFinite(value) ? value : -1);
    const rows = Object.entries(map).map(([key, step]) => ({ key, turn: num(step?.turn), place: num(step?.place), record: recordOf(key), count: countOf(key) }));
    const least = new Map();
    for (const row of rows) {
        const id = `${row.turn}|${row.record}`;
        if (!least.has(id) || row.place < least.get(id)) least.set(id, row.place);
    }
    const at = row => least.get(`${row.turn}|${row.record}`);
    const text = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    // Turn, the reply's least place, the reply, then its own steps by number (a tie: the entry's own place, then the key).
    return rows.sort((a, b) => a.turn - b.turn || at(a) - at(b) || text(a.record, b.record) || a.count - b.count || a.place - b.place || text(a.key, b.key)).map(row => row.key);
};
