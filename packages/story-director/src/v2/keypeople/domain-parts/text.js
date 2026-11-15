// Story Director v2, part **keypeople**: single-line text flattening and code-point truncation.

import { MAX_NAME } from './limits-text.js';

/** Text as one plain line: control and format characters out, spaces made one. */
export const flat = value => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** `value` flattened and cut to `max` code points (never inside a character), with an ellipsis when it was longer. */
export function cutPoints(value, max) {
    const chars = Array.from(flat(value));
    return chars.length <= max ? chars.join('') : `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** A name as it is kept: flat, cut to MAX_NAME code points. */
export const cleanName = value => cutPoints(value, MAX_NAME);
