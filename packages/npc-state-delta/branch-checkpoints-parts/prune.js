// Active/sibling checkpoint retention under the count and byte budgets.

import * as branchCore from '../branch-core.js';
import { BRANCH_SNAPSHOT_BUDGET_BYTES, BRANCH_SNAPSHOT_MAX_BYTES } from '../branch-constants.js';
import { lineageCheckpointKeys } from '../branch-lineage.js';
import { checkpointBytes } from './shared-bytes.js';
import { normalizeBranchCheckpointsV3 } from './normalize.js';

export function pruneBranchCheckpoints(checkpoints = [], activeLineage = [], limit = branchCore.BRANCH_HISTORY_LIMIT) {
    const cap = Math.max(8, Number(limit) || branchCore.BRANCH_HISTORY_LIMIT);
    const normalized = normalizeBranchCheckpointsV3(checkpoints, activeLineage);
    const activeKeys = new Set(lineageCheckpointKeys(activeLineage));
    const active = normalized.filter(item => activeKeys.has(item.lineageKey)).sort((a, b) => a.messageId - b.messageId || a.createdAt - b.createdAt);
    const siblings = normalized.filter(item => !activeKeys.has(item.lineageKey)).sort((a, b) => b.createdAt - a.createdAt || b.messageId - a.messageId);
    const keep = new Map();

    if (normalized.length <= cap) {
        for (const item of normalized) keep.set(item.lineageKey, item);
    } else {
        const siblingBudget = Math.min(siblings.length, Math.max(8, Math.floor(cap * 0.25)));
        const activeBudget = Math.max(1, cap - siblingBudget);
        if (active.length) {
            keep.set(active[0].lineageKey, active[0]);
            for (const item of active.slice(-Math.max(1, activeBudget - 1))) keep.set(item.lineageKey, item);
        }
        for (const item of siblings.slice(0, siblingBudget)) keep.set(item.lineageKey, item);
        if (!active.length) for (const item of normalized.slice(-cap)) keep.set(item.lineageKey, item);
    }

    const selected = [...keep.values()].sort((a, b) => a.messageId - b.messageId || a.createdAt - b.createdAt);
    if (!selected.length) return [];
    const budgeted = new Map();
    let used = 0;
    const oldestActive = selected.find(item => activeKeys.has(item.lineageKey)) || null;
    if (oldestActive) {
        const size = checkpointBytes(oldestActive);
        if (size <= BRANCH_SNAPSHOT_BUDGET_BYTES) {
            budgeted.set(oldestActive.lineageKey, oldestActive);
            used += size;
        }
    }
    for (const item of [...selected].sort((a, b) => b.createdAt - a.createdAt || b.messageId - a.messageId)) {
        if (budgeted.has(item.lineageKey)) continue;
        const size = checkpointBytes(item);
        if (size > BRANCH_SNAPSHOT_MAX_BYTES || used + size > BRANCH_SNAPSHOT_BUDGET_BYTES) continue;
        budgeted.set(item.lineageKey, item);
        used += size;
    }
    return [...budgeted.values()].sort((a, b) => a.messageId - b.messageId || a.createdAt - b.createdAt);
}
