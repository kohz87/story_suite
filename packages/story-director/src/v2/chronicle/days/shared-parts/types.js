// Story Director v2, chronicle part: basic type guards for day-digest values. Pure.

export const isInt = value => Number.isSafeInteger(value);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const text = value => (typeof value === 'string' ? value : '');
