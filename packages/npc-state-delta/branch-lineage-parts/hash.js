// The fast string hash that lineage fingerprints and keys are built from.

function fnv1a32(text, seed = 0x811c9dc5) {
    let hash = seed >>> 0;
    const input = String(text ?? '');
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

export function branchHash(text) {
    const input = String(text ?? '');
    return `${fnv1a32(input, 0x811c9dc5)}.${fnv1a32(input, 0x9e3779b9)}`;
}
