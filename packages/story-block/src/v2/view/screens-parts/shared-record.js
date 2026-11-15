// The plain-object test every screen part shares.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
