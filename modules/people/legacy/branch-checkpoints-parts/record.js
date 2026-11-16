// Recording branch checkpoints and the parent anchor on the branch state.

import * as branchCore from '../branch-core.js';
import { prunePortraitAssetsInPlace } from '../../storage/storage.js';
import { BRANCH_LINEAGE_VERSION, BRANCH_SNAPSHOT_MAX_BYTES } from '../branch-constants.js';
import { chatLineage, lineageCheckpointKeys, migrateLegacyLineage } from '../branch-lineage.js';
import { utf8Bytes } from '../branch-util.js';
import { appendRollbackMutation, ensureRollbackJournalBaseline, settleRollbackHead } from '../branch-rollback-journal.js';
import { ensureBranchFamilyId } from './family.js';
import { normalizeBranchCheckpointsV3 } from './normalize.js';
import { pruneBranchCheckpoints } from './prune.js';

export function ensureBranchParentAnchor(state, chat, messageId, reason = 'parent-anchor', limit = branchCore.BRANCH_HISTORY_LIMIT) {
    if (!state || typeof state !== 'object' || !Number.isInteger(messageId) || messageId < 0) return state;
    migrateLegacyLineage(state, chat);
    const lineage = chatLineage(chat);
    const previousLineage = Array.isArray(state.lineage) ? state.lineage : [];
    ensureRollbackJournalBaseline(state, previousLineage.length ? previousLineage : lineage.slice(0, Math.max(0, messageId)));
    if (previousLineage.length) settleRollbackHead(state, previousLineage, 'turn-settled');
    state.lineage = lineage;
    state.branchLineageVersion = BRANCH_LINEAGE_VERSION;
    ensureBranchFamilyId(state, lineage.slice(0, 4).join('|'));
    if (messageId === 0) {
        if (!state.branchRootSnapshot || typeof state.branchRootSnapshot !== 'object') {
            const snapshot = branchCore.snapshotBranchState(state);
            state.branchRootSnapshot = utf8Bytes(snapshot) <= BRANCH_SNAPSHOT_MAX_BYTES ? snapshot : null;
        }
        prunePortraitAssetsInPlace(state);
        return state;
    }
    if (messageId > lineage.length - 1) return state;
    const keys = lineageCheckpointKeys(lineage);
    const parentId = messageId - 1;
    const parentKey = keys[parentId];
    const checkpoints = normalizeBranchCheckpointsV3(state.checkpoints, lineage);
    if (!checkpoints.some(item => item.lineageKey === parentKey)) {
        const snapshot = branchCore.snapshotBranchState(state);
        if (utf8Bytes(snapshot) <= BRANCH_SNAPSHOT_MAX_BYTES) checkpoints.push({
            messageId: parentId,
            fingerprint: lineage[parentId],
            lineageKey: parentKey,
            parentLineageKey: parentId > 0 ? keys[parentId - 1] : 'root',
            reason: String(reason || 'parent-anchor'),
            createdAt: Date.now(),
            rollbackSeq: Math.max(0, Number(state.rollbackHead?.seq || 0)),
            snapshot,
        });
    }
    state.checkpoints = pruneBranchCheckpoints(checkpoints, lineage, limit);
    prunePortraitAssetsInPlace(state);
    return state;
}

export function recordBranchCheckpoint(state, chat, messageId, reason = 'state', limit = branchCore.BRANCH_HISTORY_LIMIT) {
    if (!state || typeof state !== 'object') return state;
    migrateLegacyLineage(state, chat);
    const lineage = chatLineage(chat);
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= lineage.length) {
        state.lineage = lineage;
        state.branchLineageVersion = BRANCH_LINEAGE_VERSION;
        ensureBranchFamilyId(state, lineage.slice(0, 4).join('|'));
        prunePortraitAssetsInPlace(state);
        return state;
    }
    const keys = lineageCheckpointKeys(lineage);
    const snapshot = branchCore.snapshotBranchState(state);
    const rollbackSeq = appendRollbackMutation(state, lineage, messageId, reason, snapshot);
    state.lineage = lineage;
    state.branchLineageVersion = BRANCH_LINEAGE_VERSION;
    ensureBranchFamilyId(state, lineage.slice(0, 4).join('|'));
    if (utf8Bytes(snapshot) <= BRANCH_SNAPSHOT_MAX_BYTES) {
        const checkpoint = {
            messageId,
            fingerprint: lineage[messageId],
            lineageKey: keys[messageId],
            parentLineageKey: messageId > 0 ? keys[messageId - 1] : 'root',
            reason: String(reason || 'state'),
            createdAt: Date.now(),
            rollbackSeq,
            snapshot,
        };
        const checkpoints = normalizeBranchCheckpointsV3(state.checkpoints, lineage);
        const existingIndex = checkpoints.findIndex(item => item.lineageKey === checkpoint.lineageKey);
        if (existingIndex >= 0) checkpoints[existingIndex] = checkpoint;
        else checkpoints.push(checkpoint);
        state.checkpoints = pruneBranchCheckpoints(checkpoints, lineage, limit);
    } else {
        state.checkpoints = pruneBranchCheckpoints(state.checkpoints, lineage, limit);
    }
    prunePortraitAssetsInPlace(state);
    return state;
}
