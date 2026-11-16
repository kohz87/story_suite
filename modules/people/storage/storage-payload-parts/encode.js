// Encodes a state, or a retired marker, to the sidecar JSON text: compacted, packed and stamped.
import { isPortraitFileRecord } from '../../portrait/portrait-file.js';
import { lineageCheckpointKeys } from '../../legacy/branch-lineage.js';
import { packCheckpoints } from '../../legacy/checkpoint-pack.js';
import { LEGACY_FORMAT_VERSION, NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_FORMAT_VERSION } from './format.js';
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

// Packing is the last step (after compactStateForFile), so portrait retention above still sees full snapshots. Any packing error
// writes the whole payload as format 1 with full checkpoints. `packing` sits before `state` so decodeStateFileHead still works.
function packedStateForFile(snapshot) {
    try {
        // A state with no checkpoint array is still written as format 2 (nothing to pack, its keys are untouched).
        if (!Array.isArray(snapshot.checkpoints)) return { packing: packCheckpoints([]).packing, state: snapshot };
        const { entries, packing } = packCheckpoints(snapshot.checkpoints, { activeKeys: lineageCheckpointKeys(snapshot.lineage) });
        return { packing, state: { ...snapshot, checkpoints: entries } };
    } catch { return null; }
}

export function encodeStateFilePayload(chatKey, state, appVersion = '', metadata = {}, writerId = '') {
    const snapshot = compactStateForFile(state);
    const packed = packedStateForFile(snapshot);
    const payload = {
        format: NPC_STATE_FILE_FORMAT,
        formatVersion: packed ? NPC_STATE_FILE_FORMAT_VERSION : LEGACY_FORMAT_VERSION,
        appVersion: String(appVersion || ''),
        chatKey: String(chatKey || ''),
        updatedAt: String(metadata?.updatedAt || new Date().toISOString()),
        revision: Math.max(0, Math.trunc(Number(metadata?.revision) || 0)),
        writerId: String(metadata?.writerId || writerId),
        ...(packed ? { packing: packed.packing } : {}),
        state: packed ? packed.state : snapshot,
    };
    return JSON.stringify(payload);
}

export function encodeRetiredStateFilePayload(chatKey, reason = 'retired', appVersion = '', metadata = {}, writerId = '') {
    return JSON.stringify({
        format: NPC_STATE_FILE_FORMAT,
        formatVersion: LEGACY_FORMAT_VERSION,
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
