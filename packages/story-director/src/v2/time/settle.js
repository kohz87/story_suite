// Story Director v2, part **time**: deadlines that slip or lapse as story time passes, and the
// While away recap (MODULES §F21). Pure: `standing` reads, `settle` writes the draft it is given.
//
// v1's rules, by import: a beat whose date went by more than two story days ago without the
// story firing it slips (lapses.slippedBeats); an offer nobody took before its deadline lapses
// (lapses.lapsedOffers, with a beat's grace once the reader spoke of it); a quest whose work is
// done and only the pay waits is never failed for the hour (tracker.waitsForPay, and v2's own
// "target met" from the quests part). A quest the reader took on whose deadline passed is
// overdue: the story is told (v1's Due now and While away) and may fail it or move the
// deadline; once the same two days of grace are gone too, time fails it ('deadline passed').
// Clocks, beats, events and agendas that came due are marked as due now; the tracker's note
// brings them in where the scene allows (v1 Pacing).
//
// Each closing is claimed (`lapse:<thread id>`), so a thread is closed by time once on a line
// of history; the claim lives in the same receipt, so swiping or deleting the reply it was
// written to takes both back. Its writes in the thread are marked (ctx.ifThere): deleting the reply
// that made the thread passes over the closing on replay, and the rest of the settle (the check, the
// recap, the other closings) still applies.
//
// Two fields of the `director` domain belong to this part (a MODULES §C1 addition):
//   checked: null | { minutes, rev, lapsed: [id], overdue: [id], pay: [id], due: [id] }
//            the story time last settled, by which receipt, and where threads stood then;
//   recap:   null | { fromMinutes, toMinutes, lines: [text], threads: [id], rev, at }
//            the While away recap for the reply after the jump; `at` is the chat's length when
//            it was made, so it is told to that reply (and its swipes) and cleared after it.
// Public face: re-exports its parts.

export { DEADLINE_REASON, REASONS, LAPSE_OUTCOME, claimKey } from './settle-parts/constants.js';
export { standing } from './settle-parts/standing.js';
export { recapStale, needsSettle } from './settle-parts/needs.js';
export { settle, settleSummary } from './settle-parts/close.js';
