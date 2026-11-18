// Encodes a state, or a retired marker, to the sidecar JSON text: compacted and stamped.
import { isPortraitFileRecord } from '../../portrait/portrait-file.js';
import { NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_FORMAT_VERSION } from './format.js';
import { pruneFormPortraitAssetsForState, prunePortraitAssetsForState } from './portrait-retention.js';

function compactStateForFile(state) {
    const snapshot = structuredClone(state || {});
    snapshot.portraitAssets = prunePortraitAssetsForState(snapshot);
    snapshot.formPortraitAssets = pruneFormPortraitAssetsForState(snapshot);
    for (const npc of Array.isArray(snapshot.npcs) ? snapshot.npcs : []) {
        if (!npc?.id) continue;
        if (npc.portrait?.dataUrl) snapshot.portraitAssets[npc.id] = structuredClone(npc.portrait);
        if (snapshot.portraitAssets[npc.id]?.dataUrl && !(isPortraitFileRecord(npc.portrait) && !npc.portrait.dataUrl)) npc.portrait = null;
    }
    return snapshot;
}

export function encodeStateFilePayload(chatKey, state, appVersion = '', metadata = {}, writerId = '') {
    const snapshot = compactStateForFile(state);
    const payload = {
        format: NPC_STATE_FILE_FORMAT,
        formatVersion: NPC_STATE_FILE_FORMAT_VERSION,
        appVersion: String(appVersion || ''),
        chatKey: String(chatKey || ''),
        updatedAt: String(metadata?.updatedAt || new Date().toISOString()),
        revision: Math.max(0, Math.trunc(Number(metadata?.revision) || 0)),
        writerId: String(metadata?.writerId || writerId),
        state: snapshot,
    };
    return JSON.stringify(payload);
}

export function encodeRetiredStateFilePayload(chatKey, reason = 'retired', appVersion = '', metadata = {}, writerId = '') {
    return JSON.stringify({
        format: NPC_STATE_FILE_FORMAT,
        formatVersion: NPC_STATE_FILE_FORMAT_VERSION,
        appVersion: String(appVersion || ''),
        chatKey: String(chatKey || ''),
        updatedAt: new Date().toISOString(),
        revision: Math.max(0, Math.trunc(Number(metadata?.revision) || 0)),
        writerId: String(metadata?.writerId || writerId),
        retired: true,
        retiredAt: new Date().toISOString(),
        retireReason: String(reason || 'retired').slice(0, 120),
        // A Detach marker names the verified copy of the bytes it replaced, so any session that
        // later finds the marker can register that backup instead of the empty marker.
        ...(metadata?.recoveryPath ? { recoveryPath: String(metadata.recoveryPath), recoveryName: String(metadata.recoveryName || '') } : {}),
        state: {},
    }, null, 2);
}
