// Story Director v2, tracker part (domain): the two type guards the domain files share.

export const isInt = value => Number.isSafeInteger(value);

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
