/* Scanner JSON repair and parsing, with scan row key normalizing. */

function stripTrailingJsonCommas(text) {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            out += ch;
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; out += ch; continue; }
        if (ch === ',') {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j])) j += 1;
            if (text[j] === '}' || text[j] === ']') continue;
        }
        out += ch;
    }
    return out;
}

function quoteBareJsonKeys(text) {
    let out = '';
    let inString = false;
    let escaped = false;
    let expectingKey = false;
    for (let i = 0; i < text.length;) {
        const ch = text[i];
        if (inString) {
            out += ch;
            i += 1;
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; out += ch; i += 1; expectingKey = false; continue; }
        if (ch === '{' || ch === ',') {
            out += ch; i += 1; expectingKey = true; continue;
        }
        if (expectingKey && /\s/.test(ch)) { out += ch; i += 1; continue; }
        if (expectingKey && /[A-Za-z_$]/.test(ch)) {
            let j = i + 1;
            while (j < text.length && /[A-Za-z0-9_$-]/.test(text[j])) j += 1;
            let k = j;
            while (k < text.length && /\s/.test(text[k])) k += 1;
            if (text[k] === ':') {
                out += `"${text.slice(i, j)}"`;
                i = j;
                expectingKey = false;
                continue;
            }
        }
        if (!/\s/.test(ch)) expectingKey = false;
        out += ch; i += 1;
    }
    return out;
}

function repairScannerJsonText(text) {
    return quoteBareJsonKeys(stripTrailingJsonCommas(text));
}

function jsonParseErrorPosition(error) {
    const match = String(error?.message || '').match(/position\s+(\d+)/i);
    return match ? Number(match[1]) : -1;
}

function isInsideJsonStringAt(text, index) {
    let inString = false;
    let escaped = false;
    for (let i = 0; i < index && i < text.length; i += 1) {
        const ch = text[i];
        if (!inString) {
            if (ch === '"') inString = true;
            continue;
        }
        if (escaped) {
            escaped = false;
        } else if (ch === '\\') {
            escaped = true;
        } else if (ch === '"') {
            inString = false;
        }
    }
    return inString;
}

function repairMissingJsonSeparator(text, error) {
    const message = String(error?.message || '');
    const arraySeparator = /expected ',' or '\]' after array element/i.test(message);
    const objectSeparator = /expected ',' or '\}' after property value/i.test(message);
    if (!arraySeparator && !objectSeparator) return text;

    let position = jsonParseErrorPosition(error);
    if (!Number.isInteger(position) || position < 0 || position > text.length) return text;
    while (position < text.length && /\s/.test(text[position])) position += 1;
    if (position >= text.length || isInsideJsonStringAt(text, position)) return text;

    let previous = position - 1;
    while (previous >= 0 && /\s/.test(text[previous])) previous -= 1;
    if (previous < 0) return text;

    const previousChar = text[previous];
    const nextChar = text[position];
    const canEndValue = /["}\]0-9el]/i.test(previousChar);
    const canStartArrayValue = /["{\[0-9tfn-]/i.test(nextChar);
    const canStartObjectKey = nextChar === '"';
    if (!canEndValue) return text;
    if (arraySeparator && !canStartArrayValue) return text;
    if (objectSeparator && !canStartObjectKey) return text;

    return `${text.slice(0, position)},${text.slice(position)}`;
}

function parseWithScannerRepairs(text, firstError) {
    let candidate = repairScannerJsonText(text);
    let lastError = firstError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
            const repaired = repairMissingJsonSeparator(candidate, error);
            if (repaired === candidate) break;
            candidate = repaired;
        }
    }
    const error = new Error(`Scanner returned malformed JSON: ${lastError.message}`);
    error.cause = firstError;
    throw error;
}

// Scan row keys: trim, "Name" -> name, "home_base" -> homeBase; a clean key in the row wins, colliding variants stay as sent.
const cleanScanKey = key => {
    const t = key.trim().replace(/[_-]+([a-z0-9])/gi, (_, c) => c.toUpperCase());
    return /^[A-Z0-9]+$/.test(t) ? t.toLowerCase() : t.charAt(0).toLowerCase() + t.slice(1);
};
function normaliseScanRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const keys = Object.keys(row), hits = {};
    for (const key of keys) hits[cleanScanKey(key)] = (hits[cleanScanKey(key)] || 0) + 1;
    return Object.fromEntries(keys.map(key => { const to = cleanScanKey(key); return [to && hits[to] === 1 && !keys.includes(to) ? to : key, row[key]]; }));
}
export const normaliseScanKeys = parsed => {
    for (const list of ['npcs', 'profileUpdates', 'profile_updates', 'keyRelationshipEdges', 'key_relationship_edges']) parsed[list] &&= Array.isArray(parsed[list]) ? parsed[list].map(normaliseScanRow) : parsed[list];
    return parsed;
};

export function parseScanJson(raw) {
    if (raw && typeof raw === 'object') return raw;
    let text = String(raw ?? '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (firstError) {
        parsed = parseWithScannerRepairs(text, firstError);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Scanner response is not a JSON object.');
    }
    if (!Array.isArray(parsed.npcs)) parsed.npcs = [];
    return normaliseScanKeys(parsed);
}
