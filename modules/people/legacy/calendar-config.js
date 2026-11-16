/* NPC State Delta calendar configuration: month parsing, normalization, the active calendar and the
   Story Suite external/cached calendar source. Split from calendar.js as a line-for-line part; the
   original keeps the public exports. Public face: re-exports its parts. */

export { cleanText, normalizeMonthKey, parseInteger } from './calendar-config-parts/shared-text.js';
export { MAX_CALENDAR_MONTHS, MAX_CALENDAR_DAYS_PER_MONTH, parseMonthDefinitions, monthDefinitionsText } from './calendar-config-parts/months.js';
export { normalizeCalendarConfig } from './calendar-config-parts/normalize.js';
export { LEGACY_NUMERIC_CALENDAR_ID, calendarFingerprint, calendarYearLength } from './calendar-config-parts/identity.js';
export { setActiveCalendarConfig, setExternalCalendarSource, getActiveCalendarConfig } from './calendar-config-parts/active.js';
