// The event key and the identity hash that tells a key collision from a repeat.
import { hashText, canonicalTuple } from './encoding.js';

// The event key: namespace, the branch-owned source identity, the complete event id (kind and source subject included) and the occurrence.
// Full ids are hashed, never truncated.
export function factKey({ ns, source, eventId, phase = '' } = {}) {
    return `v1:${hashText(canonicalTuple([ns, source, eventId, phase]))}`;
}
// What one key stands for, hashed apart from the key, so the same key met with another identity is seen as a collision.
export function factIdentity({ ns, source, eventId, phase = '' } = {}) { return hashText(`id|${canonicalTuple([ns, source, eventId, phase])}`).slice(0, 12); }
