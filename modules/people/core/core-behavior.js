/* NPC State Delta behavior profile: behavior-lever keys/families/bodies, normalization, grounding, ordering, morality and agency
   direction masks, refinement safety and merging. It also holds the three collection-grounding helpers the merge reads, and
   BEHAVIOR_PROFILE_LIMIT. A pure part of core-mechanics.js (same owner, moved without change); core-mechanics.js re-exports
   every name it exported before. Imports only core-text.js, core-relationship.js, core-durable.js. Public face: re-exports its parts. */

export { behaviorProfileFamily, behaviorProfileBody } from './core-behavior-parts/behavior-keys.js';
export { BEHAVIOR_PROFILE_LIMIT, normalizeBehaviorProfile, isBehaviorLever } from './core-behavior-parts/behavior-normalize.js';
export { reconcileBehaviorProfileWithPersonality, moralityPolarity } from './core-behavior-parts/behavior-direction.js';
export { groundedBehaviorProfile, strippedDevelopmentEvidence, durableProfileCollectionEquivalent, durableProfileCollectionCandidateGrounded } from './core-behavior-parts/behavior-grounding.js';
export { orderedBehaviorProfile } from './core-behavior-parts/behavior-order.js';
export { mergeBehaviorProfileRefinements, recoverBehaviorProfileKeepAdditions } from './core-behavior-parts/behavior-refine.js';
