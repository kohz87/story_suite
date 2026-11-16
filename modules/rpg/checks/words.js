// Story Director v2, part **checks**: the words a check is read by (contract §3 P09: "Resolve explicit stat first, else transferred
// statForCheck(skill) (unknown -> LUK)" and "the transferred topic table").
// with their patterns unchanged. Pure.
// Public face: re-exports its parts.

export { STATS, statForCheck } from './words-parts/stats.js';
export { TOPICS, TOPIC_NAMES, topicsOf } from './words-parts/topics.js';
export { DC_WORDS, dcOf, outcomeOf } from './words-parts/dc.js';
