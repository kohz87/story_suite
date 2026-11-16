/* NPC State Delta calendar-derived values: deterministic birthdays, structured World State dates,
   age/birth-date derivation and the prompt date context. Split from calendar.js as a line-for-line
   part; the original keeps the public exports. Public face: re-exports its parts. */

export { deterministicCalendarBirthday } from './calendar-derived-parts/birthday.js';
export { extractStructuredWorldDate } from './calendar-derived-parts/world-date.js';
export { deriveBirthDateFromAgeParts, deriveAgeFromBirthDate } from './calendar-derived-parts/age.js';
export { calendarPromptContext } from './calendar-derived-parts/prompt-context.js';
