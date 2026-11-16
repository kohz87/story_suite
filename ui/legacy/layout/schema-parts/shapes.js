// Plain-object and binding shape checks.

export const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export const isBinding = value => isPlainObject(value) && typeof value.query === 'string';
