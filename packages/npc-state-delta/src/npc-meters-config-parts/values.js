// The small value checks and clamps every meter parser uses.

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const isInt = value => Number.isInteger(value);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const own = (object, key) => isObject(object) && Object.hasOwn(object, key);
