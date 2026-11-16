// Turns a public value into one piece of text for the macro and the summary.

import { isObject } from './shared-basics.js';

/**
 * A value as one piece of text, for the macro and the summary: text and numbers as they are, true/false, a list as a comma list
 * (an item as "Name x2", a member by name), `null` for what has no text (nothing, an empty list, an object).
 */
export function plainText(value) {
    if (typeof value === 'string') return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() || null;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        const parts = value.map(entry => {
            if (isObject(entry)) {
                const name = plainText(entry.name);
                return name === null ? null : Number.isFinite(entry.qty) ? `${name} x${entry.qty}` : name;
            }
            return plainText(entry);
        }).filter(part => part !== null);
        return parts.length ? parts.join(', ') : null;
    }
    return null;
}
