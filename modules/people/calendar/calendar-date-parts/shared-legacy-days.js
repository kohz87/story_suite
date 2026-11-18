/* Gregorian month-length helpers for the numeric fallback calendar, shared by the date parts. */

export function legacyLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function legacyMonthDays(month, year = null) {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month === 2 && year !== null && legacyLeapYear(year)) return 29;
    if (month === 2 && year === null) return 29;
    return days[month - 1] || 0;
}
