// A small shared check for the World leads and fold parts: whether a value is a plain object.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
