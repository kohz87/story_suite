// Shared primitive type predicates for cast domain values.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInt = value => Number.isSafeInteger(value);
