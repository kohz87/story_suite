// The boundary test and the failure codes a head-selection fallback may walk past.

import { stateHash } from '../host-block.js';

export const FALLBACK_CODES = Object.freeze(['SNAPSHOT_UNAVAILABLE', 'CONFLICT']);

/** Is `code` a permanent failure the fallback may walk past? */
export const canFallback = code => FALLBACK_CODES.includes(code);

/**
 * The one boundary test: a mapping matches only when its cursor still names a uniquely witnessed
 * prefix, that prefix hash is the same, and the replayed state is the same. `through` is an optional
 * witness limit (the marker root), as in `selectionPlan`.
 */
export function boundaryMatches(mapping, witness, { through = null, stateHashOf = stateHash } = {}) {
    if (!mapping?.boundary || !mapping.after || !witness) return false;
    if (through && !(witness.index < through.index || (witness.index === through.index && witness.op <= through.op))) return false;
    return witness.prefixHash === mapping.boundary.prefixHash && stateHashOf(witness.state) === mapping.boundary.stateHash;
}
