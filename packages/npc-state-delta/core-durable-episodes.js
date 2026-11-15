/* NPC State Delta durable-profile mannerism normalization and development-episode scoping helpers.
   Split unchanged from core-durable.js; public names are re-exported by core-durable.js, while the
   episode-label helper is internal to the grounding gates. Public face: re-exports its parts. */

export { mannerismSimilarity, normalizeMannerisms } from './core-durable-episodes-parts/mannerism-match.js';
export { isExplicitRecurringMannerism, filterSafeMannerismRefinements } from './core-durable-episodes-parts/mannerism-refine.js';
export { developmentContextSegments, developmentBindingLabels, normalizedPhrasePresent, episodeContainsLabel } from './core-durable-episodes-parts/episode-labels.js';
export { BATCH_EPISODE_MAX_CHARS, scopedEpisodeText } from './core-durable-episodes-parts/episode-scope.js';
