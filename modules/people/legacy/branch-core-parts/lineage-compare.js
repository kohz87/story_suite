// Comparing a stored lineage with the live one: first divergence, relationship kind and common prefix length.

export function firstLineageDivergence(previous = [], current = []) {
    const a = Array.isArray(previous) ? previous : [];
    const b = Array.isArray(current) ? current : [];
    const common = Math.min(a.length, b.length);
    for (let i = 0; i < common; i += 1) {
        if (a[i] !== b[i]) return i;
    }
    return a.length === b.length ? -1 : common;
}

export function classifyLineageRelationship(previous = [], current = []) {
    const a = Array.isArray(previous) ? previous : [];
    const b = Array.isArray(current) ? current : [];
    const common = Math.min(a.length, b.length);
    for (let i = 0; i < common; i += 1) {
        if (a[i] !== b[i]) return { kind: 'replacement-divergence', divergence: i, commonPrefixLength: i };
    }
    if (a.length === b.length) return { kind: 'same', divergence: -1, commonPrefixLength: common };
    if (a.length < b.length) return { kind: 'forward-extension', divergence: a.length, commonPrefixLength: common };
    return { kind: 'tail-truncation', divergence: b.length, commonPrefixLength: common };
}

export function commonPrefixLength(a = [], b = []) {
    const divergence = firstLineageDivergence(a, b);
    return divergence < 0 ? Math.min(a.length, b.length) : divergence;
}
