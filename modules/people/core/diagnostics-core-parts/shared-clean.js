// Shared text and number cleaners the diagnostic sanitizers and store use: clean, finiteInt and uniqueStrings.

export function clean(value, max = 320) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function finiteInt(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
}
export function uniqueStrings(values = [], limit = 32, max = 120) {
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
        const text = clean(value, max);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}
