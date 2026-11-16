// Chronicle's shared plain-object and whole-number checks.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInt = value => Number.isSafeInteger(value);
