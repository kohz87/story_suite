// Small value checks and keys shared by the practice parts.
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = value => Number.isSafeInteger(value);
export const text = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
export const pairKey = source => `${source?.sid}/${source?.swipeKey}`;
