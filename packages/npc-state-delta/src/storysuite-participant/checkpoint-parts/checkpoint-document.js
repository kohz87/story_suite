// Building a checkpoint document and checking that a document is a whole checkpoint with its hash.

import { hashJson } from '../../adapter/hash.js';
import { PARTICIPANT_SCHEMA, KIND } from './shared-basics.js';
import { isRecord, plain } from './shared-records.js';
import { checkpointIdOf } from './checkpoint-id.js';

/** → { id, hash, doc } for the native state now. `cursor` and `headHash` are the host's (or null for a checkpoint made outside a head). */
export function buildCheckpoint({ lineage, state, cursor = null, headHash = null }) {
    const doc = {
        schema: PARTICIPANT_SCHEMA,
        kind: KIND,
        lineage: String(lineage ?? ''),
        cursor: plain(cursor),
        headHash: typeof headHash === 'string' ? headHash : null,
        state: plain(state),
    };
    const hash = hashJson(doc);
    return { id: checkpointIdOf(hash), hash, doc };
}

/**
 * '' when `doc` is a whole checkpoint with this hash; else why not. A newer schema than this code reads is a problem of its own.
 * `known` is an optional precomputed hashJson(doc) (a caller that hashed already passes it, so the document is hashed once).
 */
export function checkpointProblem(doc, hash, known) {
    if (!isRecord(doc) || doc.kind !== KIND) return 'It is not a native checkpoint of NPC State Delta.';
    if (!Number.isInteger(doc.schema) || doc.schema > PARTICIPANT_SCHEMA) return 'It was made by a newer NPC State Delta than this one.';
    if (!isRecord(doc.state) || !isRecord(doc.state.timeline) || typeof doc.lineage !== 'string') return 'It is missing the native state, its lineage or the identity map and applied deaths in it.';
    let actual = known;
    try { if (actual === undefined) actual = hashJson(doc); } catch { return 'It is not plain JSON.'; }
    return actual === hash ? '' : 'Its bytes do not hash to its hash.';
}
