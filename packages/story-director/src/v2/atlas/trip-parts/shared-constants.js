// Shared time, rounding, and formatting constants for atlas trip parts.

export const DAY = 1440;
export const tidy = value => Math.round(value * 1e6) / 1e6;
export const isInt = value => Number.isSafeInteger(value);
export const daysWord = days => (days === 1 ? '1 day' : `${tidy(days)} days`);
