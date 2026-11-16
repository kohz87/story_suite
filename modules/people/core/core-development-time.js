/* NPC State Delta development-time grounding: time-skip detection, content-token comparison,
   development-reason grounding and user-canon declarative checks. Split from core-development.js
   as a line-for-line part; the original keeps the public exports. Public face: re-exports its parts. */

export { isBareTimePassageDevelopmentReason, hasNarratedTimeSkip } from './core-development-time-parts/time-skip.js';
export { developmentReasonGrounded, contextWindowGroundsReason } from './core-development-time-parts/reason-grounding.js';
export { BATCH_DEVELOPMENT_CUE_RE, declarativeUserDevelopmentSegment, explicitDevelopmentContextGrounded } from './core-development-time-parts/canon-cues.js';
