// The small value checks: object, own key, slug, safe integer.

export const dmObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const dmOwn = (value, key) => dmObject(value) && typeof key === 'string' && Object.hasOwn(value, key);
export const dmSlug = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value)
    && !['constructor', 'prototype', '__proto__'].includes(value);
export const dmInt = (value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value)
    && Number.isSafeInteger(min) && Number.isSafeInteger(max) && value >= min && value <= max;
