import { BRANCH_LINEAGE_VERSION } from '../branch.js';

export function user(text, name = 'Kazuma') {
    return { is_user: true, is_system: false, name, mes: text };
}
export function assistant(text, swipe = 0, name = 'Megumin') {
    return { is_user: false, is_system: false, name, mes: text, swipe_id: swipe };
}

export function baseState() {
    return {
        npcs: [], dismissed: [], inlineCards: [], checkpoints: [], lineage: [],
        branchLineageVersion: BRANCH_LINEAGE_VERSION,
        turn: 0, assistantSinceScan: 0, lastScanAt: 0, lastScannedMessageId: null,
        scanCount: 0,
    };
}
