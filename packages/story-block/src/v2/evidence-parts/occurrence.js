// Proof evidence, occurrences: the number a block is stamped with, what a reply has taken, and the allocator that hands out new ones.

import { isObject, occurrenceOf, whole } from '../evidence/constants.js';
import { spanOperationKey } from './operation-key.js';

// ---------- occurrence ----------
//
// Two blocks of one reply that did exactly the same (two lines with the same text, two steps with the same command and payload) are told
// apart by their occurrence: a whole number given to a block once, when it is first stamped, kept in its span (`span.occurrence`) and
// never worked out again. A step planned again, a reconcile, a Re-read of text that did not change and a rebuild all use the one the
// block has, so an earlier block that goes cannot move the later ones onto its identity. A new block takes the next number nobody
// has used in that reply (`record.source.taken`, kept past the blocks that go, and the numbers of the blocks that stand). A block that
// gives proof and has no number was written by a build before proof was released: it is not supported (evidenceProblem) and fails closed.

const takenKey = key => key.slice(0, 16);

/** `entry` (a record's source) with the occurrences of `spans` taken: undefined when none ever was (a store with no guarded block stays as it was). */
export function takenAfter(entry, spans) {
    const out = isObject(entry?.taken) ? { ...entry.taken } : {};
    for (const span of spans) {
        const at = occurrenceOf(span);
        const key = at === null ? null : spanOperationKey(span);
        if (key) out[takenKey(key)] = Math.max(whole(out[takenKey(key)]) ?? 0, at + 1);
    }
    return Object.keys(out).length ? out : undefined;
}

/** The next occurrence nobody has used in `record` (the reply) for the operation `key`. */
export function nextOccurrence(record, key) {
    let next = whole(record?.source?.taken?.[takenKey(key)]) ?? 0;
    for (const span of Array.isArray(record?.spans) ? record.spans : []) {
        if (!isObject(span) || spanOperationKey(span) !== key) continue;
        const at = occurrenceOf(span);
        if (at !== null) next = Math.max(next, at + 1);
    }
    return next;
}

/**
 * The one place a new occurrence is allocated. A plan (a Re-read, a reconcile of a record) works on one allocator per record: it starts from
 * what the record holds (`nextOccurrence`: `record.source.taken` and the numbers of the blocks that stand, `also(key)`: numbers the plan has
 * given in blocks not stored yet) and moves on after each number it gives, so two blocks of one plan never take the same one. Nothing is
 * kept in the record until the plan is stored (the span's `occurrence` and `takenAfter` do that).
 * → { peek(key), note(key, value), take(key) }: the next number for an operation, a number used, and both.
 */
export function allocator(record, also = () => 0) {
    const given = new Map();
    const peek = key => Math.max(nextOccurrence(record, key), also(key), given.get(key) ?? 0);
    const note = (key, value) => given.set(key, Math.max(given.get(key) ?? 0, value + 1));
    return { peek, note, take(key) { const value = peek(key); note(key, value); return value; } };
}
