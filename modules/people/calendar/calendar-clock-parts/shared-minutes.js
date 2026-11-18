// Shared story-clock arithmetic: day length, Gregorian month lengths and the minutes-to-date parts.
import { MAX_CALENDAR_DAYS_PER_MONTH, MAX_CALENDAR_MONTHS } from '../calendar-config.js';
import { legacyLeapYear } from '../calendar-date.js';

export const STORY_DAY_MINUTES = 1440;
export const GREGORIAN_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Story Director's date arithmetic (its src/calendar.js makeCalendar): story time is minutes since year
// 0, the first month, day 1, 00:00; months of fixed length, with Gregorian leap years when `leapYears`
// (the extra day in the second month). → { year, monthIndex, day } or null for a malformed clock.
export function storyClockParts(minutes, calendar) {
    if (!Number.isSafeInteger(minutes) || !calendar || typeof calendar !== 'object' || !Array.isArray(calendar.months)) return null;
    const months = calendar.months.slice(0, MAX_CALENDAR_MONTHS + 1);
    if (!months.length || months.length > MAX_CALENDAR_MONTHS) return null;
    const lengths = months.map(month => Number(month?.days));
    if (!lengths.every(days => Number.isInteger(days) && days >= 1 && days <= MAX_CALENDAR_DAYS_PER_MONTH)) return null;
    const leapYears = calendar.leapYears === true;
    const count = lengths.length;
    const leapMonth = count > 1 ? 1 : 0;
    const baseYear = lengths.reduce((sum, days) => sum + days, 0);
    const averageYear = baseYear + (leapYears ? 0.2425 : 0);
    const leap = year => leapYears && legacyLeapYear(year);
    const leapsBefore = year => Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400) + 1;
    const daysBeforeYear = year => baseYear * year + (leapYears ? leapsBefore(year) : 0);
    const daysIn = (year, month) => lengths[month] + (month === leapMonth && leap(year) ? 1 : 0);
    const total = Math.floor(minutes / STORY_DAY_MINUTES);
    let year = Math.floor(total / averageYear);
    while (daysBeforeYear(year) > total) year -= 1;
    while (daysBeforeYear(year + 1) <= total) year += 1;
    let rest = total - daysBeforeYear(year);
    let month = 0;
    while (month < count - 1 && rest >= daysIn(year, month)) rest -= daysIn(year, month++);
    return Number.isSafeInteger(year) && Math.abs(year) <= 999999 ? { year, monthIndex: month, day: rest + 1 } : null;
}
