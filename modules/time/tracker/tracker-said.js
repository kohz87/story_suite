// Story Director: how the tracker reads what was said (pure): a quest whose pay is left to
// collect, a job given up, offers chosen in the reader's message, and the reason a `-`, `~` or `!`
// line gives for a quest being over. Moved out of tracker.js; tracker.js re-exports its public names.
// Public face: re-exports its parts.

export { sentencesOf, escapeRegExp, normalizeQuotes } from './tracker-said-parts/shared-text.js';
export { FAILED, OVER_VALUE, QUEST_OVER_TEXT, LOOKS_OVER } from './tracker-said-parts/over-patterns.js';
export { overStep, QUEST_OVER_FIELDS, endsJob, takenOn } from './tracker-said-parts/over-checks.js';
export { BECOMES_QUEST, isJob, isOffer, takesOnQuest } from './tracker-said-parts/job-state.js';
export { TIME_FAIL, waitsForPay, looksFinished, closingReason } from './tracker-said-parts/quest-status.js';
export { overByChange } from './tracker-said-parts/over-by-change.js';
export { ACCEPT_WORDS, AGREE_WORDS, REFUSE_WORDS, CHOSEN_END } from './tracker-said-parts/choice-words.js';
export { GIVE_UP, givenUpIn } from './tracker-said-parts/give-up.js';
export { allJobsIn, namesJob, saidAbout } from './tracker-said-parts/job-naming.js';
export { offersInQuestion, offersChosenIn } from './tracker-said-parts/offers.js';
