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
 * middle delete keeps them in order. Within a turn, replies go by where each was first written: a reply is placed by the `place`
 * (carrier index when written) of its FIRST entry (lowest count, a tie by place), the earlier placed reply first (two replies share
 * a turn only when a Re-read gives Director lines to a reply that had none). Its entries then go by their count whatever their own
 * place: a Continue written after an earlier message was deleted (or a swipe or Re-read moved the count) carries a lower place, and
 * must neither come before the reply's first steps nor move the reply before an earlier one.
 */
export const stepOrder = map => {
    const num = value => (Number.isFinite(value) ? value : -1);
    const rows = Object.entries(map).map(([key, step]) => ({ key, turn: num(step?.turn), place: num(step?.place), record: recordOf(key), count: countOf(key) }));
    const first = new Map();
    for (const row of rows) {
        const id = `${row.turn}|${row.record}`;
        const had = first.get(id);
        if (!had || row.count < had.count || (row.count === had.count && row.place < had.place)) first.set(id, row);
    }
    const at = row => first.get(`${row.turn}|${row.record}`).place;
    const text = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    // Turn, the reply's first entry's place, the reply, then its own steps by number (a tie: the entry's own place, then the key).
    return rows.sort((a, b) => a.turn - b.turn || at(a) - at(b) || text(a.record, b.record) || a.count - b.count || a.place - b.place || text(a.key, b.key)).map(row => row.key);
};
