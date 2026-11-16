// Story Director v2, tracker part (initiative): the two type guards the initiative files share.

export const isInt = value => Number.isSafeInteger(value);

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
