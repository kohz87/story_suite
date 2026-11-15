// Text flattening and code-point truncation helpers for cast strings.

/** Text as one plain line: control and format characters out, spaces made one. */
export const flat = value => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

/** `value` flattened and cut to `max` code points (never inside a character), with an ellipsis when it was longer. */
export function cutPoints(value, max) {
    const chars = Array.from(flat(value));
    return chars.length <= max ? chars.join('') : `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** `value` flattened and cut to `max` code points at a word boundary, with an ellipsis when it was longer. */
export function cutWords(value, max) {
    const chars = Array.from(flat(value));
    if (chars.length <= max) return chars.join('');
    const head = chars.slice(0, Math.max(0, max - 1)).join('');
    const space = head.lastIndexOf(' ');
    // At a space when one is past a third of the way; else the cut is where it is (a long word, no spaces).
    return `${(space >= head.length / 3 ? head.slice(0, space) : head).trimEnd().replace(/[,;:\-–—]+$/, '')}…`;
}
