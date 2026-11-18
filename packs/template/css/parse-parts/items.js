// Item reading: a block of CSS split into rules and statements, and the per-item cache of a group's items.

/**
 * Split a block of CSS into items: `{ type: 'rule', prelude, body }` for `x { … }` and
 * `{ type: 'statement', prelude }` for `x;`. Braces inside strings and parentheses are respected.
 */
export function readItems(text) {
    const items = [];
    let at = 0;
    while (at < text.length) {
        let quote = null;
        let paren = 0;
        let i = at;
        for (; i < text.length; i += 1) {
            const char = text[i];
            if (quote) {
                if (char === '\\') i += 1;
                else if (char === quote) quote = null;
            } else if (char === '"' || char === '\'') quote = char;
            else if (char === '(') paren += 1;
            else if (char === ')') paren = Math.max(0, paren - 1);
            else if (paren === 0 && (char === '{' || char === ';' || char === '}')) break;
        }
        const prelude = text.slice(at, i).trim();
        if (i >= text.length) {
            if (prelude) items.push({ type: 'statement', prelude });
            break;
        }
        if (text[i] === ';' || text[i] === '}') {
            if (prelude) items.push({ type: 'statement', prelude });
            at = i + 1;
            continue;
        }
        // Find the matching close brace.
        let depth = 1;
        let j = i + 1;
        quote = null;
        for (; j < text.length && depth > 0; j += 1) {
            const char = text[j];
            if (quote) {
                if (char === '\\') j += 1;
                else if (char === quote) quote = null;
            } else if (char === '"' || char === '\'') quote = char;
            else if (char === '{') depth += 1;
            else if (char === '}') depth -= 1;
        }
        items.push({ type: 'rule', prelude, body: text.slice(i + 1, depth === 0 ? j - 1 : j) });
        at = j;
    }
    return items;
}

// Each group's items are read once (kept on the item for scopeItems), so a sheet is read once per level.
export const groupItems = item => (item.items ??= readItems(item.body));
