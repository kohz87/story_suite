// Destructive-settlement primitives: lineage fingerprints and the controller that settles deletes and edits. Public face: re-exports its parts.
export { narrativeMessageFingerprint, narrativeLineage, firstNarrativeDivergence, destructiveMutationSettled } from './destructive-settlement-core-parts/lineage.js';
export { createDestructiveSettlementController } from './destructive-settlement-core-parts/controller.js';
