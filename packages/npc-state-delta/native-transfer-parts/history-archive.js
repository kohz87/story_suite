// Building the audit-only source-history archive and its compact form for a native bundle.
import { validateHistoryArchive } from './validate.js';

function withoutPortraitPayload(value) {
    if (Array.isArray(value)) return value.map(withoutPortraitPayload);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (key === 'portraitAssets' || key === 'formPortraitAssets') continue;
        if (key === 'portrait' && item && typeof item === 'object') {
            out[key] = { ...item };
            delete out[key].dataUrl;
            continue;
        }
        out[key] = withoutPortraitPayload(item);
    }
    return out;
}

export function buildHistoryArchive(state = {}) {
    return withoutPortraitPayload({
        policy: 'audit-only-source-history',
        turn: Number(state.turn || 0),
        lastScannedMessageId: Number.isInteger(state.lastScannedMessageId) ? state.lastScannedMessageId : null,
        lineage: Array.isArray(state.lineage) ? state.lineage : [],
        checkpoints: Array.isArray(state.checkpoints) ? state.checkpoints : [],
        branchLineageVersion: Number(state.branchLineageVersion || 0),
        branchParent: state.branchParent && typeof state.branchParent === 'object' ? state.branchParent : null,
        branchForkMessageId: Number.isInteger(state.branchForkMessageId) ? state.branchForkMessageId : null,
        branchRootSnapshot: state.branchRootSnapshot && typeof state.branchRootSnapshot === 'object' ? state.branchRootSnapshot : null,
        inlineCards: Array.isArray(state.inlineCards) ? state.inlineCards : [],
    });
}

export function compactHistoryArchive(historyArchive) {
    const checked = validateHistoryArchive(historyArchive);
    if (!checked) return null;
    return {
        policy: 'audit-only-source-history',
        turn: Number(checked.turn || 0),
        lastScannedMessageId: Number.isInteger(checked.lastScannedMessageId) ? checked.lastScannedMessageId : null,
        lineage: [],
        checkpoints: [],
        branchLineageVersion: Number(checked.branchLineageVersion || 0),
        branchParent: null,
        branchForkMessageId: Number.isInteger(checked.branchForkMessageId) ? checked.branchForkMessageId : null,
        branchRootSnapshot: null,
        inlineCards: [],
        truncated: true,
        truncationReason: 'export-size-limit',
        omittedCounts: {
            lineage: Array.isArray(checked.lineage) ? checked.lineage.length : 0,
            checkpoints: Array.isArray(checked.checkpoints) ? checked.checkpoints.length : 0,
            inlineCards: Array.isArray(checked.inlineCards) ? checked.inlineCards.length : 0,
            branchRootSnapshot: checked.branchRootSnapshot ? 1 : 0,
        },
    };
}
