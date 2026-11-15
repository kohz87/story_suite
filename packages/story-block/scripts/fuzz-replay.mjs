// Property fuzz of the replay core (docs/v2/REPLAY.md): a guarded test module, random chats, and after EVERY step these
// invariants. The head is what a replay from the first record gives (checkpoints are never trusted wrongly), the state
// at sampled carriers and the Problems are too, revs are strictly increasing and the head is at the last, a guard that
// refuses leaves no guarded effect, a quarantined record has no effect, and the boundaries of steps planned again are
// what the chat now gives. Steps: commands, send, swipe, show (any carrier), delete (swipe, message), edit, reload,
// reconcile (the turn's, after every timeline change too), truncate, Re-read, strip a record's spans, make a
// checkpoint legacy (no prefix), orphan a guarded receipt, edit a receipt's guard, edit a record's source identity,
// change an outside setting the guarded blocks record.
//
//   node scripts/fuzz-replay.mjs <seed> <steps> [checkpointEvery]      one run; prints { seed, steps, fails }
//   for s in $(seq 1 300); do node scripts/fuzz-replay.mjs $s 120 $(( (s % 2) * 3 + 4 )); done | grep -v '"fails":\[\]'
//
// Env: SB=<another checkout> to run the same seeds on it, TRACE=1 for the steps, DUMP=<file> the chat at the first failure,
// DUMPBEFORE=<file> the chat before the step that failed.
// Public face: re-exports its parts.

export { user, reply } from './fuzz-replay-parts/messages.js';
export { newSwipe, showSwipe, delSwipe } from './fuzz-replay-parts/swipes.js';
export { outcome } from './fuzz-replay-parts/run.js';
