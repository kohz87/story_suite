// Branch limits and journal constants shared by the split branch owners. A pure part of branch.js (same owner,
// moved without change); branch.js re-exports every public name it exported before. Never imports branch.js.
// Public face: re-exports its parts.
export { BRANCH_LINEAGE_VERSION, BRANCH_SNAPSHOT_BUDGET_BYTES, BRANCH_SNAPSHOT_MAX_BYTES } from './branch-constants-parts/snapshot.js';
export { ROLLBACK_JOURNAL_VERSION, ROLLBACK_JOURNAL_WINDOW_MESSAGES, ROLLBACK_JOURNAL_LIMIT, ROLLBACK_JOURNAL_BUDGET_BYTES } from './branch-constants-parts/journal.js';
