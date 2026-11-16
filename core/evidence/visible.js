// Story Suite v2 evidence, visible part: the entries a record holds, which proofs are visible (visibleProofs, merged) and the
// story.evidence query (createEvidenceQuery). Pure. evidence.js keeps the public path of each export.
// Public face: re-exports its parts.

export { recordEntries } from './visible-parts/entries.js';
export { merged, indexOf } from './visible-parts/lookup.js';
export { visibleProofs } from './visible-parts/proofs.js';
export { createEvidenceQuery } from './visible-parts/query.js';
