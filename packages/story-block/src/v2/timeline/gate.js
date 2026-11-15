// The host's check of a guard's epoch and rules hash (contract §6 and §8; docs/v2/REPLAY.md left it to the timeline
// package; docs/v2/TIMELINE.md). Pure: it looks at the state before a block and at the guard the block carries.
//
// * epoch: the savepoints domain (host-owned, made by the first save point) names the epoch of the timeline. A
//   guarded block recorded under another epoch was made on a timeline that a restore has since replaced (or one that
//   never had the restore it leans on), so it stays off. A chat with no savepoints domain has not had a restore:
//   nothing to compare, and every epoch is as good as another (old stores and modules that never use the timeline
//   behave as they did).
// * rulesHash: the `rules` slice of the state carries the frozen ruleset's hash at its root (the same marker
//   sdk.preflight reads). A guard that names a hash must meet that hash when the state has one. A state with
//   no rules marker has nothing to compare it with.
//
// Public face: re-exports its parts.

export { HOST_DOMAIN, RULES_DOMAIN, GENESIS_EPOCH, epochOf } from './gate-parts/domains.js';
export { rulesHashOf, gateProblem } from './gate-parts/check.js';
