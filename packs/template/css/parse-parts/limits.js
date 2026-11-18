// Limits and measuring: the stylesheet size and nesting caps, the UTF-8 byte length and the deepest brace nesting.

export const MAX_CSS_BYTES = 64 * 1024;
// How deep group at-rules (@media, @supports, …) may nest inside each other.
export const MAX_AT_DEPTH = 8;

/** The deepest `{` nesting in a stylesheet (comments and strings skipped): `a { }` is 1. Linear. */
export function cssDepth(source) {
    const text = String(source ?? '');
    let depth = 0;
    let deepest = 0;
    let quote = null;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (quote) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
        } else if (char === '"' || char === '\'') quote = char;
        else if (char === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 1;
        } else if (char === '{') deepest = Math.max(deepest, ++depth);
        else if (char === '}') depth = Math.max(0, depth - 1);
    }
    return deepest;
}

/** UTF-8 length of a string. */
export function bytes(text) {
    return new TextEncoder().encode(text).length;
}
