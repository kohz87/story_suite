// World events, open templates on the host: the complete result rows of an answer that was cut off (the model ran out of tokens), so one long
// plan never takes the whole batch's slots with it. Pure.

/** The rows of `"results":[ ... ]` that are whole JSON objects, in order, from a text that may end mid-way; [] when none. */
export function wholeRows(text) {
    const raw = String(text ?? '');
    const key = raw.search(/"results"\s*:\s*\[/);
    if (key < 0) return [];
    const rows = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let at = raw.indexOf('[', key) + 1; at < raw.length; at += 1) {
        const char = raw[at];
        if (inString) {
            if (char === '\\') at += 1;
            else if (char === '"') inString = false;
        } else if (char === '"') inString = true;
        else if (char === '{') {
            if (depth === 0) start = at;
            depth += 1;
        } else if (char === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                try { rows.push(JSON.parse(raw.slice(start, at + 1))); } catch { /* a broken row is left out */ }
            }
        } else if (char === ']' && depth === 0) break;
    }
    return rows;
}
