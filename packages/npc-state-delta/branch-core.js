// Branch core: scan operation registry, lineage comparison, branch snapshots, user-dismissed groups and user NPC metadata. Public face: re-exports its parts.

export { DEFAULT_SCAN_OPERATION_TIMEOUT_MS, createScanOperationRegistry } from './branch-core-parts/scan-operations.js';
export { firstLineageDivergence, classifyLineageRelationship, commonPrefixLength } from './branch-core-parts/lineage-compare.js';
export { BRANCH_HISTORY_LIMIT, snapshotBranchState, restoreSnapshotIntoState } from './branch-core-parts/snapshots.js';
export { normalizeUserDismissedGroups, addUserDismissedGroup, clearUserDismissedGroupsFor } from './branch-core-parts/dismissed-groups.js';
export { preserveUserNpcMetadata } from './branch-core-parts/user-metadata.js';
