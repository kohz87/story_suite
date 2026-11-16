// Selector scoping: prefixing drawn ids and putting the screen root in front of each selector in a list.

import { SCOPE_ALIASES } from '../parse-parts/at-rules.js';
import { splitTop } from '../parse-parts/text.js';

/** `#name` in a selector becomes `#<prefix>name` (outside strings and `[…]`), matching the drawn ids. */
export function prefixIds(selector, prefix) {
    if (!prefix || !selector.includes('#')) return selector;
    let out = '';
    let quote = null;
    let bracket = 0;
    for (let i = 0; i < selector.length; i += 1) {
        const char = selector[i];
        out += char;
        if (quote) {
            if (char === '\\' && i + 1 < selector.length) out += selector[++i];
            else if (char === quote) quote = null;
        } else if (char === '"' || char === '\'') quote = char;
        else if (char === '\\' && i + 1 < selector.length) out += selector[++i];
        else if (char === '[') bracket += 1;
        else if (char === ']') bracket = Math.max(0, bracket - 1);
        else if (char === '#' && !bracket && /[-\w\\\u0080-\uffff]/.test(selector[i + 1] ?? '')) {
            // `#name` reaches the screen's first copy (`#<prefix>name`) and every other copy drawn at the
            // same time (`<prefix>name--c<n>`, template render.js); a name written with escapes, the first.
            const name = /^[-\w\u0080-\uffff]+/.exec(selector.slice(i + 1))?.[0] ?? '';
            const next = selector[i + 1 + name.length] ?? '';
            if (!name || next === '\\') {
                out += prefix;
                continue;
            }
            out = `${out.slice(0, -1)}:is(#${prefix}${name}, [id^="${prefix}${name}--c"])`;
            i += name.length;
        }
    }
    return out;
}

export function scopeSelector(selector, scope, idPrefix = '') {
    const text = prefixIds(selector.trim(), idPrefix);
    if (!text) return '';
    const alias = SCOPE_ALIASES.exec(text);
    if (alias) return `${scope}${text.slice(alias[0].length)}`;
    return `${scope} ${text}`;
}

export function scopeSelectorList(prelude, scope, idPrefix = '') {
    return splitTop(prelude, ',').map(part => scopeSelector(part, scope, idPrefix)).filter(Boolean).join(', ');
}
