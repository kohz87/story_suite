// Story Director v2, chronicle part: its queries (pure), for the Chronicle screen and for other
// modules (NPC State Delta may link its NPCs to factions by name later).
//
// Times are written on the chat's calendar: the tracker's `director.calendar` query through
// `tools.query` (the reader's, else the enabled pack's, else Gregorian), Gregorian without it.
// "How long ago" is counted from the Director's clock (`director.time`, else the `director`
// domain). Every answer is a plain copy.
// Public face: re-exports its parts.

export { calendarFrom, nowFrom, agoText } from './queries-parts/clock.js';
export { eventOut, factionOut } from './queries-parts/out.js';
export { chronicleBoard } from './queries-parts/board.js';
export { boardDay, dayBoard, daysQuery } from './queries-parts/days-board.js';
export { dayEventsQuery, dayFactsQuery, noteFactsQuery } from './queries-parts/receipts.js';
export { queries } from './queries-parts/table.js';
