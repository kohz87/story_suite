/* NPC State Delta relationship model: defaults, milestone thresholds and the baseline, caps, impact,
   delta, progress and milestone normalizers. Pure relationship data helpers moved unchanged out of
   core-relationship.js; that file re-exports every public name it exported before. Never imports
   core-relationship.js, core-mechanics.js or core.js. Public face: re-exports its parts. */
export { DURABLE_PROFILE_LIMITS, DEFAULT_RELATIONSHIP, RELATIONSHIP_KEYS, DEFAULT_RELATIONSHIP_PROGRESS } from './core-relationship-model-parts/profile-defaults.js';
export { RELATIONSHIP_IMPACT_LEVELS, DEFAULT_RELATIONSHIP_CAPS, LEGACY_RELATIONSHIP_CAPS, RELATIONSHIP_EVENT_HISTORY_LIMIT } from './core-relationship-model-parts/impact-caps-constants.js';
export { RELATIONSHIP_MILESTONE_THRESHOLDS, RELATIONSHIP_MILESTONE_REQUIREMENTS, RELATIONSHIP_MILESTONE_MIN_RAW, RELATIONSHIP_MILESTONE_LIMIT } from './core-relationship-model-parts/milestone-constants.js';
export { normalizeRelationshipBaseline, normalizeRelationshipCaps } from './core-relationship-model-parts/baseline-caps.js';
export { normalizeRelationshipImpact, normalizeScannerRelationshipImpact } from './core-relationship-model-parts/impact.js';
export { normalizeRelationshipDelta, normalizeRelationshipAbsolutePatch, normalizeRelationshipAuditDelta, normalizeRelationshipProgress } from './core-relationship-model-parts/deltas.js';
export { normalizeRelationshipMilestones, relationshipMilestoneUnlocked, inferManualRelationshipMilestones, applyRelationshipMilestoneCrossings } from './core-relationship-model-parts/milestones.js';
