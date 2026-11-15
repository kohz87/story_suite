// Story Director v2, tracker part: the `director` domain read as a v1 tracker and back (pure).
//
// v1's tracker rules (src/tracker.js) hold years of fixes: closing a quest from its step text,
// near keys, giving up, pay waiting. They work on v1 records
// (`{ key, id: lineKey(key), kind, status, fields, extra, created, … }`) in an array. v2 keeps
// threads by ID in `director.threads`. These converters let the v1 rules run unchanged on v2
// state: a v1 record is built from each thread, the rules run, and every record is written
// back onto its thread with the v2-only parts (`taken`, `target`, `reward`) kept as they were.
//
// v1 bookkeeping v2 has no field for (when a record was created, changed, seen, closed; its
// leg's start, whether the reader spoke of an offer, its arc) rides on the thread's `track`.
// The positions there count replies with Director lines (`director.turn.n`), v1's `message`.
//
// Public face: re-exports its parts.

export { OUTCOMES, THREAD_KINDS } from './convert-parts/vocab.js';
export { orderedThreads, toRecord, toTracker } from './convert-parts/to-tracker.js';
export { outcomeOf } from './convert-parts/outcome.js';
export { canonical, sameValue } from './convert-parts/compare.js';
export { fromRecord, keysOf } from './convert-parts/from-record.js';
