// Features: the plain-object test the feature parts share.

export const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
