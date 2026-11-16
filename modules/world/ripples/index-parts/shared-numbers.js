// Object and number helpers shared by the ripples parts.

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const whole = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
export const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
export const when = value => (Number.isSafeInteger(value) ? value : null);
