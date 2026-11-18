// The built-in game's calendar as the packs read it: the twelve Gregorian month names and the leap-year rule (the time module's Gregorian preset agrees).

export const GREGORIAN_NAMES = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

/** Whether `year` is a Gregorian leap year (every fourth, but not a century unless it divides by 400). */
export const gregorianLeap = year => Number.isInteger(year) && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
