// Interpreter 1. No host calls, randomness or mutable caches: the caller supplies a checked,
// frozen definition and a disposable instance. Reads refer to the original prefix, even when
// a preceding effect in this root has changed the draft.
// Public face: re-exports its parts.
export { DataModuleError, refuse } from './interpreter-parts/errors.js';
export { copy, bytes, atPath } from './interpreter-parts/values.js';
export { scalarHolds } from './interpreter-parts/scalars.js';
export { titlePart, entryAt } from './interpreter-parts/entry-names.js';
export { entryAddProblem, carryEntries } from './interpreter-parts/entry-lists.js';
export { orList, cleanList, parseLabels } from './interpreter-parts/labels.js';
export { createEvaluation } from './interpreter-parts/evaluation.js';
export { conditionHolds } from './interpreter-parts/condition-holds.js';
