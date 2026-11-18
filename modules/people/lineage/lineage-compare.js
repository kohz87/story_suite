// Comparing a stored lineage with the live one: the first message where they differ.

export function firstLineageDivergence(previous = [], current = []) {
    const a = Array.isArray(previous) ? previous : [];
    const b = Array.isArray(current) ? current : [];
    const common = Math.min(a.length, b.length);
    for (let i = 0; i < common; i += 1) {
        if (a[i] !== b[i]) return i;
    }
    return a.length === b.length ? -1 : common;
}
