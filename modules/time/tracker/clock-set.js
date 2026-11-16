// Story Director v2, tracker part: the reader's own edit of the story clock (`director.clock`).
//
// The reader sets the date and time by hand (the Game view's Edit button): `{ year, month, day, minutes }`, month and day
// counted from 1, `minutes` the minutes of that day (0 to 1439). Director checks it on the chat's calendar (leap years
// included) and refuses a bad one with one plain sentence that names the field; nothing is saved then. A good one SETS the
// clock on the reply the reader is looking at, as a `~ time <date>` line does (`ctx.absolute`): a swipe or a delete of that
// reply takes it back, a replay or a reload gives the same clock, and the replies before it are not touched. It may go back
// (a rewind: what hangs on the clock follows it, as it does a story's own earlier `~ time`) and it is not held to the
// longest time jump a story's own lines are (`maxJump`). Only the reader sets it this way (cause `ui`); the story writes
// `~ time` and other rules take time through `director.advance`.
// Public face: re-exports its parts.

export { partsOf, heroDate, clockProblem } from './clock-set-parts/date.js';
export { CLOCK, clockCommand } from './clock-set-parts/command.js';
export { CALENDAR_NAMES, calendarNamesHook, calendarNamesCommand } from './clock-set-parts/names.js';
