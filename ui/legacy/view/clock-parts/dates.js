// Turns minutes since the epoch into a year, month, day and minute-of-day on a calendar.

const DAY = 1440;

const isLeap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
// Leap years in [0, year): year 0 is one (proleptic), as the Director counts them.
const leapsBefore = year => Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400) + 1;

/** `{ year, month, day, minutes }` (month 0-based) for `abs` minutes on `calendar`. */
export function dateOf(abs, calendar) {
    const { months, leapYears } = calendar;
    const yearDays = months.reduce((sum, month) => sum + month.days, 0);
    const leapMonth = months.length > 1 ? 1 : 0;
    const leap = year => leapYears && isLeap(year);
    const daysBeforeYear = year => yearDays * year + (leapYears ? leapsBefore(year) : 0);
    const monthDays = (year, month) => months[month].days + (month === leapMonth && leap(year) ? 1 : 0);
    const total = Math.floor(abs / DAY);
    const minutes = abs - total * DAY;
    let year = Math.floor(total / (yearDays + (leapYears ? 0.2425 : 0)));
    while (daysBeforeYear(year) > total) year -= 1;
    while (daysBeforeYear(year + 1) <= total) year += 1;
    let rest = total - daysBeforeYear(year);
    let month = 0;
    while (month < months.length - 1 && rest >= monthDays(year, month)) rest -= monthDays(year, month++);
    return { year, month, day: rest + 1, minutes };
}
