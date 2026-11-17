// A frozen copy of the lineage key the capture journal and the non-hosted capture map were keyed by before they moved to the reply's own ID (N7). The old branch
// code may be deleted without breaking either: this file holds the whole recipe (message fingerprint, chained key) and never changes. Pure.

function fnv1a32(text, seed) {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}
const hashOf = text => { const input = String(text ?? ''); return `${fnv1a32(input, 0x811c9dc5)}.${fnv1a32(input, 0x9e3779b9)}`; };

/** The fingerprint of one message: its speaker side and text (not the hidden flag, dates or swipe numbers). */
export function frozenFingerprint(message = {}) {
    return hashOf(JSON.stringify({ user: Boolean(message?.is_user), system: false, text: String(message?.mes || '') }));
}
/** The chained key of every message of `chat`: each one hashes its own fingerprint and the key before it. */
export function frozenLineageKeys(chat = []) {
    const keys = [];
    let parent = 'root';
    for (let i = 0; i < (Array.isArray(chat) ? chat : []).length; i += 1) {
        parent = hashOf(`${parent}|${i}|${frozenFingerprint(chat[i])}`);
        keys.push(parent);
    }
    return keys;
}
/** The key of the message at `messageId` ('' when there is none). */
export function frozenLineageKey(chat, messageId) {
    return Number.isInteger(messageId) && messageId >= 0 ? frozenLineageKeys(chat)[messageId] || '' : '';
}
