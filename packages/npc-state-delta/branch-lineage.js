// Narrative lineage: message fingerprints, lineage keys and hidden-message key repair. A pure part of branch.js
// (same owner, moved without change); branch.js re-exports every public name it exported before. Never imports branch.js.
// Public face: re-exports its parts.

export { provenanceHint, setBranchProvenanceHint } from './branch-lineage-parts/provenance-hint.js';
export { branchHash } from './branch-lineage-parts/hash.js';
export { fingerprintMessage, legacySystemFingerprint, chatLineage } from './branch-lineage-parts/fingerprint.js';
export { stripStorySuiteBlocks, onlyStorySuiteBlocksChanged } from './branch-lineage-parts/story-suite-blocks.js';
export { priorCaptureFor } from './branch-lineage-parts/prior-capture.js';
export { lineageCheckpointKeys, lineageCheckpointKey } from './branch-lineage-parts/lineage-keys.js';
export { remapLineageKeys } from './branch-lineage-parts/lineage-remap.js';
export { migrateLegacyLineage } from './branch-lineage-parts/migrate-legacy.js';
