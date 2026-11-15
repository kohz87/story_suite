// Story Director: relevance (pure).
//
// Decides, for one point in the story, which tracked records the next reply needs to know
// about: what is due or arriving, what is relevant (and in which order, so the note can drop
// the least important first), what sits on the dormant shelf, and which secrets to guard.
// Dormancy is derived here every time and never stored on the record.
// Public face: re-exports its parts.

export { DEFAULTS, estimateTokens } from './relevance-parts/defaults.js';
export { dateOf } from './relevance-parts/shared-dates.js';
export { isDue, isArriving, isDormant } from './relevance-parts/status.js';
export { AWAY_GAP_MINUTES, awayIn } from './relevance-parts/away.js';
export { classify } from './relevance-parts/classify.js';
export { encountersIn } from './relevance-parts/encounters.js';
