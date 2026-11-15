// Binding scopes: the flat State view, helper roots, query hook, changed() check, and child scopes for drafts
// and loop items. The pointer and changed symbols stay private to this module pair.
// Public face: re-exports its parts.

export { makeScope, stateView } from './scope-parts/build.js';
export { isScope } from './scope-parts/shared-changed.js';
export { withDraft, withItem } from './scope-parts/derive.js';
