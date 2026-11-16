// Choices and Inner chatter: flattening a text to one plain line and cutting it by code points.

const ELLIPSIS = '…';

/**
 * `text` as one plain line: invisible format and control characters out (zero-width, bidi marks),
 * Unicode NFC, runs of whitespace as one space, trimmed.
 */
export function flatten(text) {
    return String(text ?? '').replace(/[\p{Cf}\p{Cc}]+/gu, ' ').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** `text` cut to at most `max` code points (an ellipsis in the last place when it was longer). */
export function cutPoints(text, max) {
    const points = Array.from(String(text ?? ''));
    if (points.length <= max) return points.join('');
    return `${points.slice(0, Math.max(0, max - 1)).join('').trimEnd()}${ELLIPSIS}`;
}
