// Story Director v2, chronicle part: the Journal's categories and the [Earlier days] backlog (pure).
//
// classify(entry): the Journal category of one happened line, from its receipt's type (`{ type, text }`, carried
// through the day facts). A stored day with no types (older digests) falls back to the known shapes of its text
// (classifyText), else Events. Bookkeeping ("is here" / "is not here" presence, the key people's "noted" tick, the
// code's own receipts) is its own category, which the Journal does not show.
//
// backlogBlock(input): the optional tail block "[Earlier days]": at most six lines, one per past day, picked by
// relevance (people present now, the current place, open threads), and always the last two past days. A line reads
// "Goldwane 18 (3 days ago): …": the relative day is counted in code from the story clock (agoWords), never by the
// model. Each day gives one line; a thread's several lines of one day keep only the latest, and the body is cut to
// BODY_CHARS, then the people who were there for it (the day's recorded present lists, new days only) follow in brackets: at most three names, then "+N";
// the plain lines are fitted first, then the names go back on from the highest-ranked line down while there is room. The days come from the Journal's known days (world/journal.js knownDay), so what {{user}} does not
// know (secrets, planner text) never goes in. Nothing on the first day or with no clock. The block is about
// 200 tokens (BACKLOG_CHARS): when space is short, the lowest-ranked lines go first. Pure and deterministic.
// Public face: re-exports its parts.

export { CATEGORIES, DEFAULT_CATEGORY, classifyText, classify } from './backlog-parts/classify.js';
export { parseTag, bucketDay, trimCats } from './backlog-parts/buckets.js';
export { BACKLOG_TAG, BACKLOG_LINES, BACKLOG_CHARS, ALWAYS_DAYS } from './backlog-parts/limits.js';
export { BODY_CHARS, WITNESS_NAMES, agoWords, witnessText } from './backlog-parts/witness.js';
export { backlogBlock } from './backlog-parts/block.js';
