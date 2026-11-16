// Message hashing and the remembered earlier texts of each message object, shared by the fingerprint and block-change parts.
import { branchHash } from './hash.js';

export function messageFingerprint(message = {}, system = false) {
    return branchHash(JSON.stringify({
        user: Boolean(message.is_user),
        system,
        text: String(message.mes || ''),
    }));
}

// The texts each message object has said, newest last. fingerprintMessage notes the text every time a lineage is computed (it runs at every
// receipt, load and event), so when a reply is edited in place its earlier texts are still known when the edit is reconciled. Several saves (or a
// block rewritten by its owner right after a save) can pass before the reconcile runs, so more than the last one is kept.
export const seenText = new WeakMap();
const SEEN_TEXT_LIMIT = 8;
export function noteMessageText(message) {
    if (!message || typeof message !== 'object') return;
    const mes = String(message.mes ?? '');
    const seen = seenText.get(message);
    if (!seen) seenText.set(message, { mes, past: [] });
    else if (seen.mes !== mes) { seen.past.push(seen.mes); if (seen.past.length > SEEN_TEXT_LIMIT) seen.past.shift(); seen.mes = mes; }
}
