// The plain value checks: record ID, map, count and minute.
export const recordId = value => typeof value === 'string' && /^[a-z][a-z0-9]*_[0-9a-z]{8}$/.test(value);
export const map = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const count = value => Number.isSafeInteger(value) && value >= 0;
export const minute = value => value === null || Number.isSafeInteger(value);
