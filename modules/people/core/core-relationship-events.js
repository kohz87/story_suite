/* NPC State Delta relationship evidence and event history: evidence normalization and grounding,
   duplicate detection, event append, summary consistency and calibration. Moved unchanged out of
   core-relationship.js; that file re-exports every public name it exported before. Never imports
   core-relationship.js, core-mechanics.js or core.js. Public face: re-exports its parts. */
export { normalizeRelationshipEvidence } from './core-relationship-events-parts/shared-evidence.js';
export { relationshipAxisEvidenceGrounded, filterRelationshipDeltaByEvidence, relationshipChangeReasonGrounded } from './core-relationship-events-parts/grounding.js';
export { relationshipEventMessage, normalizeRelationshipEventHistory, appendRelationshipEvent } from './core-relationship-events-parts/history.js';
export { relationshipChangeLooksDuplicate, relationshipHistoryLooksDuplicate } from './core-relationship-events-parts/duplicates.js';
export { relationshipSummaryConsistent, calibrateRelationshipSummary } from './core-relationship-events-parts/summary.js';
