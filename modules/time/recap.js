// Story Director v2, part **time**: what the next reply is told about time that passed (pure).
//
// * The While away recap (v1 0.9.19, note.js and relevance.js awayIn): when the story clock
//   jumped far enough between two replies, what came due or arrived in the gap is told once, as
//   news or aftermath, in one `[While away] …` line. v1 picks the records and writes the items;
//   this part only sets the jump's length (the reader's setting) and v2's change-line forms.
// * What time closed (v1 lapses.js read back by note.js): beats that slipped, offers that
//   lapsed, in v1's words, and quests whose deadline passed, told once in the settle receipt.
// Public face: re-exports its parts.

export { AWAY_RECORD_V2, AWAY_ARRIVAL_V2, AWAY_DEADLINE_V2, v2Asks } from './recap-parts/asks.js';
export { RECAP_TAG, RECAP_BUDGET, buildRecap } from './recap-parts/build.js';
export { lapseSummary } from './recap-parts/lapse.js';
