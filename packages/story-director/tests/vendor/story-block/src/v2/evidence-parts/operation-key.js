// Proof evidence, operation keys: what a root or a span's operation is, apart from where it stands in the reply.

import { isObject } from '../evidence/constants.js';
import { hashJson } from '../replay.js';

/**
 * What a root is, apart from where it stands in the reply: its command and, for a story line, the line as written (the same
 * thing store.js calls a line's key). Two blocks of one reply that did the same thing are told apart by their rank among them.
 */
export function operationKey(type, payload) {
    return hashJson({ type, line: typeof payload?.raw === 'string' ? payload.raw : payload ?? {} });
}

/** The key a span's operation has (operationKey), or null. */
export function spanOperationKey(span) {
    try { return isObject(span?.operation) ? operationKey(span.operation.type, span.operation.payload) : null; } catch { return null; }
}
