// Story Director v2, tracker part: the story clock on the reader's calendar (pure).
//
// `director.time.minutes` is v1's story time: minutes since the calendar's epoch (calendar.js).
// The story moves it with a `time` line: `~ time Goldwane 12, 12:45 pm` sets it to a date
// (read as v1 reads the scene's time, the nearest year to the time before), `! time +2h` moves
// it on. The calendar is the reader's (settings section 'Calendar'): by default (preset `pack`) the
// first enabled pack's (Story Block's query `packs.calendar`), else Gregorian; a reader who picks
// `gregorian` or `custom` keeps their own whatever the packs say. A pack that gives a start date
// sets the clock before the first reply when the story has not (`director.seed`).
// Public face: re-exports its parts.

export { PACK_PRESET, PRESET_CHOICES, SEED_CLAIM } from './time-parts/constants.js';
export { MAX_JUMP_DAYS, MAX_YEAR } from './time-parts/limits.js';
export { settingsDefaults, maxJumpMinutes, settingsFrom } from './time-parts/settings.js';
export { packCalendarOf, calendarConfig, calendarOf, startMinutes } from './time-parts/calendar.js';
export { durationMinutes, lineStretch, sameStretch } from './time-parts/duration.js';
export { splitTimeLine, timeAfter } from './time-parts/timeline.js';
