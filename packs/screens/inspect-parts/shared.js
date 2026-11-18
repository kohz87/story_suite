// The inspector's shared pieces: the size limits, the JSON Pointer step and the two shape tests.

export const LIMITS = Object.freeze({
    diff: 300,       // changed paths listed for one reply
    matches: 200,    // search hits in one state
    snippet: 60,     // characters of a reply's text in the picker
    preview: 120,    // characters of a value written on one line
});

export const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isBranch = value => value !== null && typeof value === 'object';

/** A JSON Pointer one step down (RFC 6901: `~` → `~0`, `/` → `~1`). */
export function pointer(parent, key) {
    return `${parent}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
}
