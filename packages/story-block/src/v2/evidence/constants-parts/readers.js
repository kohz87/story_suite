// Proof evidence constants, readers: the small readers every evidence part shares (isObject, utf8, whole, occurrenceOf).

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const utf8 = new TextEncoder();

export const whole = value => (Number.isInteger(value) && value >= 0 ? value : null);

/** The occurrence a block was stamped with, or null (a block from before there was one). */
export const occurrenceOf = span => whole(span?.occurrence);
