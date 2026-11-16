// Reading a change line: a label looked up by name, and a count such as "x2". Pure.

/** A change line's label, looked up case-insensitively under any of `names`; null when absent. */
export function labelOf(line, ...names) {
    const labels = line?.labels ?? {};
    for (const name of names) {
        for (const key of Object.keys(labels)) {
            if (key.trim().toLowerCase() === name) return String(labels[key] ?? '').trim();
        }
    }
    return null;
}

/** "2", "x2", "2×" → 2; anything else → null. */
export function parseCount(text) {
    const m = /^[x×]?\s*(\d{1,6})\s*[x×]?$/i.exec(String(text ?? '').trim());
    return m ? Number(m[1]) : null;
}
