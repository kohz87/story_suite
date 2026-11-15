// Text readers: comment stripping, escape decoding, call arguments and top-level splits.

/** Drop comments, keeping strings intact. */
export function stripComments(text) {
    let out = '';
    let quote = null;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (quote) {
            out += char;
            if (char === '\\' && i + 1 < text.length) out += text[++i];
            else if (char === quote) quote = null;
        } else if (char === '"' || char === '\'') {
            quote = char;
            out += char;
        } else if (char === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 1;
            out += ' ';
        } else out += char;
    }
    return out;
}

/** Split at a separator outside strings and brackets. */
export function splitTop(text, separator) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (quote) {
            if (char === '\\' && i + 1 < text.length) {
                current += char + text[++i];
                continue;
            }
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

/** CSS escapes decoded (`\75 rl(` → `url(`), so checks see what the browser will. */
export function decodeEscapes(text) {
    return text.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([^\n])/g, (_, hex, char) => {
        if (char !== undefined) return char;
        const code = parseInt(hex, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\uFFFD';
    });
}

/** The arguments of the call whose `(` is at `open`, up to its matching `)` (strings respected). */
export function callArgs(text, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < text.length; i += 1) {
        const char = text[i];
        if (quote) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
        } else if (char === '"' || char === '\'') quote = char;
        else if (char === '(') depth += 1;
        else if (char === ')' && --depth === 0) return text.slice(open + 1, i);
    }
    return text.slice(open + 1);
}
