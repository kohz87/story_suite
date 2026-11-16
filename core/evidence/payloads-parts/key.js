// Proof evidence payloads, key: what names a proof inside one root.

import { hashJson } from '../../replay.js';

/**
 * What names a proof inside one root (contract §6: the same key with a changed payload is a CONFLICT): an
 * acceptance is its thread, a check is its check id; a payload nobody shaped is its own key, so a different
 * payload is simply another proof.
 */
export function payloadKey(kind, payload) {
    if (kind === 'acceptance') return `thread:${payload.thread}`;
    if (kind === 'event' && Object.hasOwn(payload, 'check')) return `check:${payload.check}`;
    return `payload:${hashJson(payload)}`;
}
