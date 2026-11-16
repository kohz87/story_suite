/* NPC State Delta calendar date parsing and arithmetic: Gregorian/custom date normalization,
   ordinals, absolute day numbers, legacy story-day migration and the current calendar date.
   Split from calendar.js as a line-for-line part; the original keeps the public exports. Public face: re-exports its parts. */

export { legacyLeapYear, legacyMonthDays } from './calendar-date-parts/shared-legacy-days.js';
export { escapeRegex, normalizeCalendarDate } from './calendar-date-parts/parse.js';
export { formatCalendarDate, currentCalendarDate } from './calendar-date-parts/format.js';
export { dateOrdinal, STORY_DAY_SCHEME, migrateLegacyStoryDay, calendarDayNumber } from './calendar-date-parts/day-numbers.js';
