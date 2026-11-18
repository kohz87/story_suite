// Relationship pacing: how many events of each impact tier one NPC can have per story day (setting
// `relationshipAllowance`), and what an event over its allowance counts as. Pure: no DOM, no clock of its own,
// no randomness. The story day is given in; the count lives on the record (`impactDay`), written in the same
// change as the move it paces, so a replay, a rebuild, a swipe and a Re-read give the live values.
//
//   impactDay = { day, reply, ordinary, meaningful, major, extreme }   (flat on the slice: see toFlatDay)
//   day    the story day the counts are for: the clock before `reply` (its own time lines cannot refresh it)
//   reply  the reply that fixed `day` (its record ID or index, as `turn.reply`); later events of it reuse `day`
//
// Used by: src/npc-meters.js (spendFlatEvent: a story line and a forwarded scanner change, counted on the slice record) and
// src/relationship-pass.js (Delta alone, counted on Delta's own record). Never imports either of them. The hosted-only
// words and cut of a held event are in src/npc-meters-pacing.js.
// Public face: re-exports its parts.
export { PACING_TIERS, pacedTier } from './relationship-pacing-parts/shared-tiers.js';
export { DEFAULT_ALLOWANCE, ALLOWANCE_MAX, normalizeAllowance } from './relationship-pacing-parts/allowance.js';
export { impactDayProblems, toFlatDay, fromFlatDay, flatDayProblems } from './relationship-pacing-parts/flat-day.js';
export { spendEvent, spendFlatEvent } from './relationship-pacing-parts/spend.js';
export { pacingDefaults } from './relationship-pacing-parts/defaults.js';
