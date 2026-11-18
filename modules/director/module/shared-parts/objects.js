// Story Director v2: the small shared object helper.

export const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
