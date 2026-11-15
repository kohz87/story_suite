// The bounded raw-message rollback journal: normalization, retention, baseline, append and settlement.
// A pure part of branch.js (same owner, moved without change); branch.js re-exports every public name it exported
// before. Never imports branch.js.
// Public face: re-exports its parts.

export { normalizeRollbackJournal } from './branch-rollback-journal-parts/entries.js';
export { pruneRollbackJournal, refreshRollbackJournalRetention } from './branch-rollback-journal-parts/retention.js';
export { ensureRollbackJournalBaseline } from './branch-rollback-journal-parts/baseline.js';
export { appendRollbackMutation, settleRollbackHead } from './branch-rollback-journal-parts/mutations.js';
