// Story Director: the note's header, no-weekday line and distance lines (pure).
//
// These smaller sections moved out of note.js; note.js re-exports their public names.
// Public face: re-exports its parts.
export { header, noteHeader } from './note-extra-parts/header.js';
export { DISTANCES_OFF, distancesLine } from './note-extra-parts/distances.js';
export { NO_WEEKDAYS, noWeekLine } from './note-extra-parts/no-week.js';
