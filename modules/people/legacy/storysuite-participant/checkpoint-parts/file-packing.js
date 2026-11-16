// Packing a checkpoint for its on-disk file and unpacking what the vault read.

import { packCheckpoints, unpackCheckpoints } from '../../checkpoint-pack.js';
import { PARTICIPANT_SCHEMA, KIND_PACKED } from './shared-basics.js';
import { isRecord } from './shared-records.js';

// The on-disk form (vault.js): the same document with `state.checkpoints` (Delta's own rollback history, nine tenths of the bytes and a copy of
// it in every file) packed like sidecar format 2. Ids and hashes are of the plain document; a packed file is unpacked on read, so every reader
// sees the document it hashed. A different `kind` makes an older build refuse the file cleanly instead of reading packed entries as snapshots.

/** → the packed wrapper for `doc`, or `doc` itself when packing is not possible or does not reproduce the document exactly (never throws). */
export function packForFile(doc) {
    try {
        if (!isRecord(doc) || !isRecord(doc.state) || !Array.isArray(doc.state.checkpoints) || !doc.state.checkpoints.length) return doc;
        const { entries, packing } = packCheckpoints(doc.state.checkpoints);
        const wrapper = { schema: PARTICIPANT_SCHEMA, kind: KIND_PACKED, packing, doc: { ...doc, state: { ...doc.state, checkpoints: entries } } };
        const back = unpackFromFile(JSON.parse(JSON.stringify(wrapper)));
        // Compared as text (key order included): stricter than the hash and much cheaper on a multi-megabyte document.
        return back && JSON.stringify(back) === JSON.stringify(doc) ? wrapper : doc;
    } catch { return doc; }
}

/** → the plain document of what the vault read: a packed wrapper is unpacked (null when it cannot be rebuilt); anything else is returned as it is. */
export function unpackFromFile(raw) {
    if (!isRecord(raw) || raw.kind !== KIND_PACKED) return raw;
    try {
        if (!isRecord(raw.doc) || !isRecord(raw.doc.state) || !Array.isArray(raw.doc.state.checkpoints)) return null;
        return { ...raw.doc, state: { ...raw.doc.state, checkpoints: unpackCheckpoints(raw.doc.state.checkpoints, raw.packing) } };
    } catch { return null; }
}
