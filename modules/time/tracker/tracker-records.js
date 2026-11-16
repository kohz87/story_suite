// Story Director: the tracker's record shape (pure).
//
// Empty tracker, blank fields, copy-on-write helpers, record building and the shared constants
// applyOps uses. Moved out of tracker.js; tracker.js re-exports its public name.
// Public face: re-exports its parts.

export { SUPERSEDED, NOT_STARTED, isLabelKey, MAX_ALIASES } from './tracker-records-parts/constants.js';
export { emptyTracker, blankFields, cloneRecord, aliasIndexOf } from './tracker-records-parts/shape.js';
export { applyFields, touch, newRecord } from './tracker-records-parts/mutate.js';
export { finding, hasContent, untrackedRecordOp, withArticle } from './tracker-records-parts/ops.js';
