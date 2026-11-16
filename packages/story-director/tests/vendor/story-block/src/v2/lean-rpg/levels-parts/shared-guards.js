// Levels: the two small type tests the level parts share.

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = value => Number.isSafeInteger(value);
