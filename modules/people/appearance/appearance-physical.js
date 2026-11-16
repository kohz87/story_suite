/* Appearance physical-feature rules: trait keys, enduring-trait carry, shared-piece deduplication and
   refinement similarity. A pure part of appearance.js (same owner, moved without change); appearance.js
   keeps the public facade and re-exports every public name. Never imports appearance.js.
   Public face: re-exports its parts. */
export { STOPWORDS, ALIASES, conceptToken, refinementTokens } from './appearance-physical-parts/refine-tokens.js';
export { grounded, similarity, safeRefinement, mergeRefinement } from './appearance-physical-parts/refine-compare.js';
export { PHYSICAL_TRAITS, CHANGEABLE_PRESENTATION, CONCEALED_MENTION, SIZE_ONLY } from './appearance-physical-parts/trait-patterns.js';
export { presentationSegments, physicalTraitKeys, HAIR_DESCRIPTOR, addressedTraitKeys } from './appearance-physical-parts/segments.js';
export { traitParts, MIXED_CLAUSE_SPLIT, physicalPieces } from './appearance-physical-parts/pieces.js';
export { NOT_IDENTITY, identityPhrase, BECOMES_IDENTITY, describesIdentity } from './appearance-physical-parts/identity.js';
export { preserveOmittedPhysicalTraits } from './appearance-physical-parts/preserve.js';
export { NEGATED_DETAIL, coveredBySharedTokens, withoutSharedPieces } from './appearance-physical-parts/shared-pieces.js';
export { physicalTraitSwaps, physicalTraitSwapped, withoutTraitSwaps } from './appearance-physical-parts/trait-swaps.js';
export { guessedTraits, filledGuess, settledGuess, withSettledGuess } from './appearance-physical-parts/guess.js';
