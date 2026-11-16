/* Shared social-graph limits and text normalization/similarity helpers.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { SOCIAL_GRAPH_VERSION, SOCIAL_GRAPH_EDGE_LIMIT, SOCIAL_GRAPH_UNRESOLVED_LIMIT, SOCIAL_GRAPH_SUPPRESSED_LIMIT } from './social-primitives-parts/graph-limits.js';
export { SOCIAL_KEY_RELATIONSHIP_MAX_CHARS, SOCIAL_DYNAMIC_MAX_CHARS, projectedTieLimit } from './social-primitives-parts/text-limits.js';
export { clean, normalizedWhitespace, cleanBoundary, norm } from './social-primitives-parts/text-clean.js';
export { uniq, slug, confidenceRank } from './social-primitives-parts/text-lists.js';
export { SOCIAL_SEMANTIC_STOPWORDS, semanticWords, semanticOverlap, nearDuplicateText } from './social-primitives-parts/text-similarity.js';
export { cleanDynamic, richer } from './social-primitives-parts/dynamic-text.js';
