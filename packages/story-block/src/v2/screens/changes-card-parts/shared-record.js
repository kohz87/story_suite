// Tells whether a value is a plain record, for the card's digest and reply lines.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
