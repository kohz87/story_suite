/* NPC State Delta story-clock bridge: the Story Director clock source and memo, story-minute
   formatting, agreement with Delta's calendar, and hosted/current date fallbacks. Split from
   calendar.js as a line-for-line part; the original keeps the public exports. Public face: re-exports its parts. */
export { setStoryClockSource, withStoryDateMemo } from './calendar-clock-parts/clock-source.js';
export { setStoryDateAtSource, storyDateTextAt } from './calendar-clock-parts/date-text-source.js';
export { setStoryDayAtSource, storyClockDayAt } from './calendar-clock-parts/day-source.js';
export { storyMinuteText, storyDayText } from './calendar-clock-parts/minute-text.js';
export { storyClockDate, hostedStoryDate, storyCurrentDate } from './calendar-clock-parts/clock-date.js';
