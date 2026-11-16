// Story Director: field truncation and note part construction.
import { NOTE_PART_WORDS } from './constants.js';

const DEFAULT_PART_WORDS = 16;
const ELLIPSIS = '…';

/**
 * `text` as the note writes it for `field`: trimmed, and cut after the field's word limit at a
 * word boundary with "…". A cut that would leave a bracket open goes back to before it, when
 * words are left; trailing commas, semicolons and dashes go.
 */
export function notePart(text, field) {
    const value = String(text ?? '').trim();
    const limit = NOTE_PART_WORDS[field] ?? DEFAULT_PART_WORDS;
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length <= limit) return value;
    let kept = words.slice(0, limit);
    const open = kept.reduce((last, word, index) => {
        const opens = (word.match(/[([]/g) ?? []).length;
        const closes = (word.match(/[)\]]/g) ?? []).length;
        return opens > closes ? index : closes > opens ? -1 : last;
    }, -1);
    if (open > 0) kept = kept.slice(0, open);
    return `${kept.join(' ').replace(/[\s,;:—–-]+$/u, '')}${ELLIPSIS}`;
}

// A record's field as the note writes it.
export function fieldOf(record, field) {
    return notePart(record?.fields?.[field], field);
}

export function part(label, text, join = '\n') {
    return { label, text, join };
}
