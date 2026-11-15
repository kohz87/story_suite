// Safe literal slots: one short plain line for a name, title or label, and the player label.
import { MAX_LITERAL } from './limits.js';

// A literal slot is safe when it is one short line of plain characters with no quote marks of its own: a longer or odd one is not truncated
// into a different fact, the option is simply unavailable.
export function safeLiteral(value, max = MAX_LITERAL) {
    const text = typeof value === 'string' ? value.normalize('NFC').trim() : '';
    if (!text || [...text].length > max) return '';
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029"“”<>`\\]/.test(text)) return '';
    return text;
}

export function playerLabel(value) { return safeLiteral(value, 60) || 'the player'; }
