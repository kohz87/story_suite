// The failure envelope of contract §3: the known codes, the `{ ok: false }` answer and the code a failure may pass on.

/** The ErrorCode union of contract §3 the timeline answers with. */
export const CODES = Object.freeze(['INVALID', 'REFUSED', 'NOT_FOUND', 'NOT_ENOUGH', 'CLAIMED', 'STALE', 'FEATURE_OFF', 'LIMITED', 'FAILED',
    'NOT_OWNER', 'UNSUPPORTED', 'UNKNOWN_COMMAND', 'DEPENDENCY_UNAVAILABLE', 'CLOCK_UNSET', 'RULES_MISMATCH', 'CONFLICT',
    'SNAPSHOT_UNAVAILABLE', 'RESTORE_PENDING', 'REPLAY_PREREQUISITE']);

/** `{ ok: false, code, message }`. */
export const fail = (code, message) => ({ ok: false, code, message });

/** The code of a failure envelope or thrown error the timeline may pass on: a known code, else FAILED. */
export const codeOf = value => (typeof value === 'string' && CODES.includes(value) ? value : 'FAILED');
