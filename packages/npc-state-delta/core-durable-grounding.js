/* NPC State Delta durable-profile grounding and safety gates: source support, speech attribution,
   appearance correction/change and unmarked refinement admission. Split unchanged from
   core-durable.js; public names are re-exported by core-durable.js. Public face: re-exports its parts. */

export { durableRefinementSupportText } from './core-durable-grounding-parts/support-text.js';
export { speechSeedVetoed, speechSupportContext } from './core-durable-grounding-parts/speech-claims.js';
export { durableRefinementCandidateGrounded } from './core-durable-grounding-parts/candidate-grounded.js';
export { isSafeIdentityTextRefinement, isSafeSpeechRefinement, isSafeUnmarkedDurableFieldReplacement } from './core-durable-grounding-parts/refinement-safety.js';
export { groundedAppearanceCorrection, groundedAppearanceChange, groundedTraitEvent } from './core-durable-grounding-parts/appearance-grounding.js';
export { presentationContinuationEvidence, npcScopedNarration } from './core-durable-grounding-parts/presentation-scope.js';
export { isSafeUnmarkedDurableRefinement, isSafeUnmarkedDurableReplacement, mergeDurableTextRefinement } from './core-durable-grounding-parts/unmarked-safety.js';
