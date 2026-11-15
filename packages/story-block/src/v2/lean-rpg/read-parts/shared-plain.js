// Plain value readers shared by the sheet-reading parts, and the pattern of the text fields a pack may hide.
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const int = value => (Number.isSafeInteger(value) ? value : null);
export const text = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

export const TEXT_KEY = /^(who|about\d*|skill\d+|foe\d+)$/;
