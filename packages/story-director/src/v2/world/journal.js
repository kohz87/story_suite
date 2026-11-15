// Story Director v2, part **world**: the Journal, the World screen's second view (pure, worked out on read).
//
// One entry per story day, newest first: where {{user}} went, who they met, the news they learned, the
// quests they took on and finished (failed, gave up), the fights and money of the day, NPC State Delta's
// stage moves, and what else the story was told. It is the day digest's data (chronicle/days.js, feature
// `story-director.digest`, through `chronicle.dayBoard`), which the Days screen showed before, plus the day
// still under way ("today so far", and a day just ended whose digest is not written yet), read from the
// same day-facts entries the digest will be written from (`chronicle.dayFacts`, and the receipts since the
// last note through `chronicle.noteFacts`), so nothing new is stored. Only what {{user}} knows (known.js): a line naming
// a secret or an arc, or an arc planner's own line in an older digest, is left out. While the digest is off
// the Journal says so and shows nothing.
// Public face: re-exports its parts.

export { isNarratorNote } from './journal-parts/narrator-note.js';
export { knownDay } from './journal-parts/day.js';
export { journalView, journalEvents } from './journal-parts/view.js';
export { journalDay } from './journal-parts/day-lines.js';
