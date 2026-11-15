// Story Director v2, chronicle part: the day digest (feature `story-director.digest`, TRS idea 2). Pure.
//
// When the story clock has crossed into a new day, code writes what each finished day held, from
// the stored receipts and the state alone: no model call, no model prose. What a digest holds:
//   happened  the code-written summaries of the day's other receipts (what the story was told first),
//             at most 8, with how many more there were;
//   places    where the scene moved to (Story Block's `place` receipts);
//   quests    taken on, finished, failed or given up that day (the threads' own `taken` and `ended`
//             stamps, by the receipt that made them);
//   fights    how many ended, won, lost or fled;
//   money     what came in and went out, in the currency's smallest unit (the receipts' own amounts);
//   npcs      stage moves of NPC State Delta's meters (its receipts' `stages`);
//   world     the chronicle's own world lines of that day (their receipt summaries);
//   met       who came into the scene that day (Story Block's `present` receipts' `added` names), kept
//             only when there is someone (older digests have none), for the World screen's Journal.
// and one line made of those facts. Every number is one code wrote down; every text is a receipt's
// own summary, a name the state keeps, or a calendar date.
//
// Which day a receipt belongs to: receipts are walked in chat order and the clock is followed through
// the receipts that set it (the tracker's `time` line, the pack's start, the time part's settle and
// `director.advance`, each with `data.minutes`). A receipt belongs to the day the clock was on when it was committed; before the
// clock was first set, to the first day it was set to.
//
// chronicle.days    = { [day]: [Digest] }   each day a slot (../slot.js), written whole
//   a whole Digest made from the day's kept entries has `src` (their revisions) and follows them (daysOf);
// chronicle.written = null | [{ through, days: [day], at, skip }]
//   through: the day the clock was on when digests were last written (days before it are done);
//   days:    the days that had a digest then, so one a deleted reply took away is written again;
//   at:      the chat's length then (the reply that was about to be written);
//   skip:    the story had just jumped far ahead (a time skip), so that reply hears the last day.
// Older days are kept short (their line only) and the oldest dropped: see `capDays`.
//
// Public face: re-exports its parts.

export { DIGEST_FEATURE, DIGEST, DAY_MINUTES } from './days-parts/digest-constants.js';
export { DIGEST_DEFAULTS, FULL_MAX, KEEP_MAX } from './days-parts/digest-limits.js';
export { FOLD_AT, FOLLOW_MAX } from './days-parts/digest-ceilings.js';
export { MAX_HAPPENED, MAX_PLACES, MAX_QUESTS, MAX_NPCS } from './days-parts/digest-caps.js';
export { MAX_WORLD, MAX_ITEM, MAX_LINE, MAX_DATE } from './days-parts/text-caps.js';
export { MAX_NAME, MAX_MET, MAX_WHO } from './days-parts/entry-caps.js';
export { QUEST_LOG_KEPT, QUEST_LOG_TEXT } from './days-parts/log-constants.js';
export { agoText, flat, cut, dayOf } from './days-parts/shared-text.js';
export { daysOf, followDigest, orderedDays, writtenOf } from './days-parts/digest-read.js';
export { digestSettings } from './days-parts/digest-settings.js';
export { walkDays } from './days-parts/walk-days.js';
export { questLogOf, notedOf, entriesByDay, rangeDays } from './days-parts/day-entries.js';
export { entryOf, eventsOf, sceneOf } from './days-parts/facts-entry.js';
export { foldEntries, factsOf, dayFacts, hasFacts } from './days-parts/facts-fold.js';
export { moneyText, fightText, dayLine } from './days-parts/summary-line.js';
export { makeDigest, briefOf, capDays, digestOut } from './days-parts/summary-digest.js';
export { validateDays } from './days-parts/validate.js';
