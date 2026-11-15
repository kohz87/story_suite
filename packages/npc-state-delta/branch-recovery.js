// Recovery helpers for lineage settlement and delete/edit boundaries: user dismissals, message positions,
// matching checkpoints, linear journal restore and prefix retention. A pure part of branch.js (same owner,
// moved without change); branch.js re-exports every public name it exported before. Never imports branch.js.
// Public face: re-exports its parts.

export { enforceUserDismissals } from './branch-recovery-parts/user-dismissals.js';
export { latestAssistantMessageId, assistantMessageCountAtOrAfter } from './branch-recovery-parts/message-positions.js';
export { matchingCheckpoints, restoreLinearBoundaryFromJournal, retainLinearPrefixHistory } from './branch-recovery-parts/linear-boundary.js';
