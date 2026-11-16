// Telling a plain record from an array, null or scalar.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
