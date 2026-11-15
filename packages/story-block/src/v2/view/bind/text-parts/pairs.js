// Splits `name: expr; name: expr` attribute lists at top-level separators.

/**
 * `name: expr; name: expr` lists (data-bind-attr, data-bind-var, data-class). Splits at `;` and the first
 * `:` outside quotes and brackets. Returns `[[name, exprText]]`.
 */
export function splitPairs(source) {
    const pairs = [];
    for (const part of splitTop(String(source ?? ''), ';')) {
        const colon = part.indexOf(':');
        if (colon < 0) continue;
        const name = part.slice(0, colon).trim();
        const expr = part.slice(colon + 1).trim();
        if (name && expr) pairs.push([name, expr]);
    }
    return pairs;
}

function splitTop(source, separator) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (const char of source) {
        if (quote) {
            if (char === quote) quote = null;
        } else if (char === '"' || char === '\'') quote = char;
        else if (char === '(' || char === '[') depth += 1;
        else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
        else if (char === separator && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    parts.push(current);
    return parts;
}
