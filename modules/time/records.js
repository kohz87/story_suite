// Story Director v2, part **time**: its settings, the reader's calendar, and the `director`
// domain's threads read as v1 tracker records (pure).
//
// v1's time rules (src/lapses.js, src/relevance.js, src/note.js, src/tracker.js) work on v1
// records in an array. This part only reads threads that way to run those rules unchanged; it
// never writes a v1 record back: what it changes on a thread it changes on the draft itself
// (settle.js), in v2's shape (MODULES §C1).
// Public face: re-exports its parts.

export { DEFAULTS, timeSettings, calendarOf } from './records-parts/settings.js';
export { recordOf } from './records-parts/reading.js';
export { orderedThreads, trackerOf } from './records-parts/tracker.js';
