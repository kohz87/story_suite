/* NPC State Delta durable text helpers: concept tokens, grounding coverage, semantic similarity,
   compact-equivalent choice, clause splitting, semantic deduplication and compact durable text.
   Moved unchanged out of core-relationship.js; that file re-exports every public name it exported
   before. Never imports core-relationship.js, core-mechanics.js or core.js. Public face: re-exports its parts. */
export { durableRefinementTokens } from './core-relationship-text-parts/tokens.js';
export { durableTokenCoverage, durableSeedGrounded, durableEvidenceGroundsValue } from './core-relationship-text-parts/grounding.js';
export { durableSemanticSimilarity, chooseCompactEquivalent, semanticDedupeItems } from './core-relationship-text-parts/similarity.js';
export { splitDurableClaimUnits, compactDurableText } from './core-relationship-text-parts/clauses.js';
