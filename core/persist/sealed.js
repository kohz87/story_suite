// Story Suite v2: the sealed record (docs/dev/saves-and-persist.md "Sealed history"). A reply older than the retention window keeps its
// ids, rev, marks and receipts (their display data and `data.v2` too), and loses what only replay reads: ops, spans, checkpoints, the
// guarded receipts' seed and replan. It is written as v3, so an older build sees a newer version's record and opens the chat read-only
// (store/tombs.js rawKind) instead of replaying the window on top of the greeting.

import { isObject } from './carrier-parts/identity.js';

/** The version a sealed record is written with. */
export const SEALED_V = 3;

// What the chain and the checkpoints keep on a record (the base replaces them all), and what only a guarded replay reads off a receipt.
const CHAIN_FIELDS = ['checkpoint', 'covers', 'coverHash', 'prefix', 'guardEnv', 'carried', 'owned'];
const REPLAY_RECEIPT_FIELDS = ['seed', 'replan'];

/** Is this a sealed record (v3, marked sealed, with no changes of its own)? */
export function isSealed(record) {
    return isObject(record) && record.v === SEALED_V && record.sealed === 1 && Array.isArray(record.ops) && record.ops.length === 0
        && Array.isArray(record.receipts) && Array.isArray(record.narrated) && record.checkpoint === undefined;
}

// A receipt as a sealed record keeps it: everything but what a guarded replay reads to plan the step again.
function sealedReceipt(receipt) {
    if (!isObject(receipt)) return receipt;
    const out = { ...receipt };
    for (const field of REPLAY_RECEIPT_FIELDS) delete out[field];
    return out;
}

/** The sealed form of a v2 record (a new object; the record itself is not touched). A record that is sealed already comes back as it is. */
export function sealRecord(record) {
    if (isSealed(record)) return record;
    if (!isObject(record) || record.v !== 2) throw new TypeError('Only a story record (v2) can be sealed.');
    const out = { ...record, v: SEALED_V, sealed: 1, ops: [], spans: [], receipts: record.receipts.map(sealedReceipt) };
    for (const field of CHAIN_FIELDS) delete out[field];
    return out;
}
