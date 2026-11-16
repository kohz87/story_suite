// Names everything replay reads from a stored record, and the bookkeeping fields it does not.

import { isObject } from './shared-object.js';

/**
 * EVERYTHING replay reads from a stored record, in one place (the store hashes exactly this for a checkpoint's prefix, so
 * what replay reads and what trust covers cannot drift apart; tests/v2/replay-review4.test.js reads replay through a
 * recording proxy and fails on any field that is not listed here or in REPLAY_BOOKKEEPING):
 * * `ops` and `spans` in full (the blocks, and for a guarded block its whole metadata: guard, claims, source, recorded
 *   inputs, operation, boundaries, result, replan);
 * * every receipt but its display `data` (id, rev, cause, seed, type, the host's `guarded` mark, replan, ...) and the
 *   `data.v2` that a trim keeps (the guard the receipt kept is compared with the span's);
 * * the source identity the span is compared with (`logical`, `swipeKey`, `evidence`) and the record's `sid`.
 * The text of the reply a guarded block was stored for is part of the prefix too, and the store adds it (it belongs to
 * the message, not the record). Plain JSON, never changed in place.
 */
export function replayInputsOf(record) {
    const source = isObject(record.source) ? { logical: record.source.logical ?? null, swipeKey: record.source.swipeKey ?? null, evidence: record.source.evidence ?? null } : null;
    return {
        sid: record.sid ?? null,
        ops: record.ops,
        spans: Array.isArray(record.spans) ? record.spans : null,
        receipts: record.receipts.map(receipt => {
            if (!isObject(receipt)) return receipt;
            const { data, ...rest } = receipt;
            return { ...rest, v2: isObject(data) && data.v2 !== undefined ? data.v2 : null };
        }),
        source,
    };
}

/** Record fields replay (or the chain around it) reads that are not replay inputs: bookkeeping about the record or the chain. */
export const REPLAY_BOOKKEEPING = Object.freeze(['v', 'narrated', 'swipe', 'mark', 'rev', 'checkpoint', 'covers', 'coverHash', 'guardEnv', 'prefix', 'carried', 'owned', 'practiceRule', 'foeCap', 'rules']);
