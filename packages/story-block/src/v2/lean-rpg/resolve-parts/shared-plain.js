// The plain-object check shared by the resolve parts.
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
