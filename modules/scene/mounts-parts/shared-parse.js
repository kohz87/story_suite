// Reads a mount line's text fields and whole numbers, for the capture and the pencil.

import { parseCount } from '../domains/common.js';
import { trimText } from '../names.js';
import { STRINGS, fill } from '../../../core/strings.js';

const M = STRINGS.mounts;

// A text field as stored: one line, cut with an ellipsis; null when the line did not give it.
export const textOf = (value, max) => (value === null || value === undefined ? null : trimText(value, max));

// A whole number between 1 and `max` from a line's label (null when it gave none); a number outside is held to the range
// and said in the Problem, anything else is refused.
export function whole(ctx, text, what, max, notes, parse = parseCount) {
    if (text === null || text === undefined || text === '') return null;
    const n = typeof text === 'number' ? text : parse(text);
    if (!Number.isSafeInteger(n)) return ctx.fail('INVALID', fill(M.notNumber, { what }));
    const held = Math.min(max, Math.max(1, n));
    if (held !== n) notes.push(fill(M.held, { what, n: held }));
    return held;
}

export const paceNumber = text => {
    const m = /^\s*(\d{1,6})(?:\s*(?:km|kms|kilometres|kilometers)?\s*(?:\/|per|a)?\s*(?:day|d)?)?\s*$/i.exec(String(text ?? ''));
    return m ? Number(m[1]) : null;
};
