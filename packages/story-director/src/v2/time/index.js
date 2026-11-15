// Story Director v2, part **time** (MODULES §F21): deadlines that slip or lapse when story time
// passes, and the While away recap after a jump. No domain of its own: it reads the story clock
// (`director.time.minutes`, the tracker part's) and writes `checked` and `recap` on the
// `director` domain, and closes threads time ran past (status, ended, offer, rev).
//
// Before each reply (`beforeGenerate`), the clock is compared with the last time settled. When
// it moved (or a deadline is due to lapse, or the recap was for an earlier reply) the hook
// commits `time.settle` as a `system` receipt on the reply where the time passed, so swiping or
// deleting that reply takes it all back. Its summary tells the next reply what slipped, in v1's
// words; the recap goes in this part's tail, for that reply only.
//
// Commands: `time.settle` (the hook's) and `director.advance` (another module's rule moving the clock
// on; see advance.js).
// Queries: `time.now` (the clock for other modules: minutes, the calendar text, the story day and its
// date), `time.overdue` and `time.recap`.
// Public face: re-exports its parts.

export { SETTLE, beforeGenerate } from './index-parts/settle-hook.js';
export { timeTail } from './index-parts/tail.js';
export { nowQuery, queries } from './index-parts/queries.js';
export { part } from './index-parts/part.js';
