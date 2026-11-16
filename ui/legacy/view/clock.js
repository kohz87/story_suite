// Story Suite v2: the story clock in words, for templates' `fmt.time(minutes)` (Home, Scene, cards, the
// status strip). Story Director keeps the clock as minutes since its calendar's epoch: year 0, the first
// month, day 1, 00:00, with Gregorian leap years when the calendar has them. This writes those minutes
// on that same calendar, the way the Director writes them: "CY 611, Goldwane 12, 7:40 pm", or
// "Goldwane 12, 611, 7:40 pm" for a calendar without an era.
//
// The calendar, first that answers:
//   1. Story Director's `director.calendar`: the one the chat's clock runs on (the reader's own choice,
//      else the enabled pack's, else Gregorian);
//   2. Story Block's `packs.calendar`: the first enabled pack's;
//   3. Gregorian.
// Pure apart from the `query` it is given.
// Public face: re-exports its parts.

export { calendarFrom, storyCalendar } from './clock-parts/calendar.js';
export { dateOf } from './clock-parts/dates.js';
export { clockText, formatStoryTime, timeFormatter } from './clock-parts/format.js';
