// The hash of one message's narrative content (speaker kind and text), the base of every lineage fingerprint.
import { branchHash } from './hash.js';

export function messageFingerprint(message = {}, system = false) {
    return branchHash(JSON.stringify({
        user: Boolean(message.is_user),
        system,
        text: String(message.mes || ''),
    }));
}
