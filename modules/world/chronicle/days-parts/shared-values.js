// Story Director v2, chronicle part: shared primitive type guards and string helpers. Pure.

export const isInt = value => Number.isSafeInteger(value);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const text = value => (typeof value === 'string' ? value : '');
export const codePoints = value => Array.from(text(value)).length;
