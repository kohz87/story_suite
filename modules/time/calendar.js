// Story Director: calendars, date parsing and date maths (pure).
//
// Story time is "abs": minutes since the calendar's epoch, which is year 0, the first month,
// day 1, 00:00. Every calendar is a list of months with fixed lengths, optionally with
// Gregorian leap years (the extra day goes to the second month, February in the preset).
// Parsing is deliberately lenient because the dates come from model prose and ledger lines.
// Public face: re-exports its parts.
export { DEFAULT_PARTS_OF_DAY, ERA_CHARS, MAX_WEEK_DAYS, NAME_CHARS } from './calendar-parts/defaults.js';
export { oneLine, parseWeek } from './calendar-parts/text.js';
export { PRESETS } from './calendar-parts/presets.js';
export { normalizeCalendar, sharedCalendar } from './calendar-parts/config.js';
export { makeCalendar } from './calendar-parts/calendar.js';
