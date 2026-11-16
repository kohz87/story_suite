// Narrative-lineage fingerprints of a chat and the divergence and settled-mutation checks built on them.

// Hiding a message (memory extensions set is_system) is not a narrative change; the role here must
// match branch lineage identity, which ignores the flag.
function normalizedRole(message = {}) {
    return message?.is_user ? 'user' : 'assistant';
}

function fnv1a(value) {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function narrativeMessageFingerprint(message = {}) {
    const role = normalizedRole(message);
    return `${role}:${fnv1a(`${role}\u001f${String(message?.mes ?? '')}`)}`;
}

export function narrativeLineage(chat = []) {
    return (Array.isArray(chat) ? chat : []).map(narrativeMessageFingerprint);
}

export function firstNarrativeDivergence(previous = [], current = []) {
    const left = Array.isArray(previous) ? previous : [];
    const right = Array.isArray(current) ? current : [];
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i += 1) if (left[i] !== right[i]) return i;
    return left.length === right.length ? -1 : length;
}

export function destructiveMutationSettled(operation, previous = [], current = []) {
    const kind = String(operation || '').toLowerCase();
    if (!Array.isArray(previous) || !previous.length) return false;
    if (kind === 'delete') return Array.isArray(current) && current.length < previous.length;
    if (kind === 'edit') return firstNarrativeDivergence(previous, current) >= 0;
    return false;
}
