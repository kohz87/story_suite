// Full branch checkpoints: normalization, active/sibling retention budgets, parent anchors and recording.
// A pure part of branch.js (same owner, moved without change); branch.js re-exports every public name it exported
// before. Never imports branch.js. Public face: re-exports its parts.
export { ensureBranchFamilyId } from './branch-checkpoints-parts/family.js';
export { normalizeBranchCheckpointsV3 } from './branch-checkpoints-parts/normalize.js';
export { pruneBranchCheckpoints } from './branch-checkpoints-parts/prune.js';
export { ensureBranchParentAnchor, recordBranchCheckpoint } from './branch-checkpoints-parts/record.js';
