// A value written on one line, cut to size.

import { cutAt, oneLine } from '../../../../../core/text.js';
import { LIMITS, isPlain } from './shared.js';

/** A value written on one line, cut at `max` characters: `"text"`, `3`, `{4 keys}`, `[2 items]`. */
export function preview(value, max = LIMITS.preview) {
    if (value === undefined) return '—';
    if (Array.isArray(value)) return `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`;
    if (isPlain(value)) {
        const n = Object.keys(value).length;
        return `{${n} ${n === 1 ? 'key' : 'keys'}}`;
    }
    let text;
    try { text = JSON.stringify(value); } catch { text = String(value); }
    text = oneLine(text ?? String(value));
    return text.length > max ? `${cutAt(text, max - 1)}…` : text;
}
