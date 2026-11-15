// The job: the plain shape tests the pack checks share (object, whole number, text of a length, finite number).

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInt = (value, min = 0) => Number.isInteger(value) && value >= min;
export const isText = (value, max) => typeof value === 'string' && value.length <= max;
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
