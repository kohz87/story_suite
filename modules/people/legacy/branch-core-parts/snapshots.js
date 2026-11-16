// Branch state snapshots: the history limit, taking a snapshot of the narrative state and restoring one into a state.
import { normalizeSocialGraph } from '../../social/social.js';
import { isPortraitFileRecord } from '../../portrait/portrait-file.js';
import { cloneNpcList } from './shared-npc-records.js';

export const BRANCH_HISTORY_LIMIT = 160;

function cloneNarrativeNpcs(npcs) {
    // A snapshot omits portrait pictures (the live record or portraitAssets holds them). A file-form record is a few hundred bytes naming a
    // file that is never deleted, so it stays: a person restored by a rollback has their portrait without any asset kept for them.
    return cloneNpcList(npcs).map(npc => ({ ...npc, portrait: isPortraitFileRecord(npc?.portrait) ? npc.portrait : null }));
}

export function snapshotBranchState(state = {}) {
    return {
        npcs: cloneNarrativeNpcs(state.npcs),
        candidates: Array.isArray(state.candidates) ? structuredClone(state.candidates) : [],
        pendingBackfills: Array.isArray(state.pendingBackfills) ? structuredClone(state.pendingBackfills) : [],
        socialGraph: normalizeSocialGraph(state.socialGraph),
        dismissed: Array.isArray(state.dismissed) ? [...state.dismissed] : [],
        turn: Number(state.turn || 0),
        assistantSinceScan: Number(state.assistantSinceScan || 0),
        lastScanAt: Number(state.lastScanAt || 0),
        lastScannedMessageId: Number.isInteger(state.lastScannedMessageId) ? state.lastScannedMessageId : null,
        readAhead: Array.isArray(state.readAhead) ? state.readAhead.filter(Number.isInteger) : [],
        scanCount: Number(state.scanCount || 0),
    };
}

export function restoreSnapshotIntoState(current = {}, snapshot = null) {
    if (!snapshot) return { ...current };
    return {
        ...current,
        npcs: cloneNpcList(snapshot.npcs),
        candidates: Array.isArray(snapshot.candidates) ? structuredClone(snapshot.candidates) : [],
        pendingBackfills: Array.isArray(snapshot.pendingBackfills) ? structuredClone(snapshot.pendingBackfills) : [],
        socialGraph: normalizeSocialGraph(snapshot.socialGraph),
        dismissed: Array.isArray(snapshot.dismissed) ? [...snapshot.dismissed] : [],
        turn: Number(snapshot.turn || 0),
        assistantSinceScan: Number(snapshot.assistantSinceScan || 0),
        lastScanAt: Number(snapshot.lastScanAt || 0),
        lastScannedMessageId: Number.isInteger(snapshot.lastScannedMessageId) ? snapshot.lastScannedMessageId : null,
        readAhead: Array.isArray(snapshot.readAhead) ? snapshot.readAhead.filter(Number.isInteger) : [],
        scanCount: Number(snapshot.scanCount || 0),
    };
}
