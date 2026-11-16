// Story Director v2, tracker part (scene): the plain-text helpers the scene rules share (record test, flatten, cut, fold).

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Text as one plain line: control and format characters out, spaces made one. */
export const flat = value => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** `value` flattened and cut to `max` code points (never inside a character), with "…" when longer. */
export function cutPoints(value, max) {
    const chars = Array.from(flat(value));
    return chars.length <= max ? chars.join('') : `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

export const normalize = value => flat(value).toLowerCase();
