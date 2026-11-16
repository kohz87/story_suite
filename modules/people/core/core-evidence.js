/* NPC State Delta profile-development evidence: evidence normalizing/merging/retention, claim negation and polarity, representation
   checks, trend opposites, evidence tagging and gradualProfileEvolutionReady, with PROFILE_EVIDENCE_LIMIT. A pure part of
   core-mechanics.js (same owner, moved without change); core-mechanics.js re-exports every name it exported before.
   Public face: re-exports its parts. */
export { PROFILE_EVIDENCE_LIMIT } from './core-evidence-parts/shared-retention.js';
export { emptyProfileEvidence, normalizeProfileEvidence, promptProfileEvidence, profileEvidenceCount } from './core-evidence-parts/normalize.js';
export { mergeRecentProfileEvidence, mergeProfileEvidence } from './core-evidence-parts/merge.js';
export { durableProfileEvidenceRelated } from './core-evidence-parts/related.js';
export { durableProfileEvolutionCandidateGrounded, durableProfileCandidateSupport, durableProfileAggregateCandidateGrounded, durableProfileEvidenceReason } from './core-evidence-parts/candidate-grounding.js';
export { durableEvidenceContradicts } from './core-evidence-parts/trend-contradiction.js';
export { durableProfileEvidenceAlreadyRepresented } from './core-evidence-parts/represented.js';
export { unresolvedProfileEvidence, unresolvedCollectionEvidence } from './core-evidence-parts/unresolved.js';
export { tagScanEvidence } from './core-evidence-parts/scan-tags.js';
export { gradualProfileEvolutionReady } from './core-evidence-parts/readiness.js';
