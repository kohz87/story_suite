import assert from 'node:assert/strict';
import { recordBranchCheckpoint, ensureBranchParentAnchor, BRANCH_LINEAGE_VERSION } from '../../modules/people/legacy/branch.js';
import { decodeStateFilePayload, encodeStateFilePayload, NPC_STATE_FILE_FORMAT, prunePortraitAssetsForState, pruneFormPortraitAssetsForState } from '../../modules/people/storage/storage.js';
import { createNpcRecord } from '../../modules/people/core/core.js';
import { isPortraitFileRecord } from '../../modules/people/portrait/portrait-file.js';

// Frozen copies of the format-1 behaviour (storage-payload.js at e2d027d): the compact + encode an older build runs on save.
export function legacyCompactState(state) {
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
export const legacyEncodeV1 = (chatKey, state, revision = 1) => JSON.stringify({ format: NPC_STATE_FILE_FORMAT, formatVersion: 1, appVersion: 't', chatKey, updatedAt: 'u', revision, writerId: 'w', state: legacyCompactState(state) });
export function legacyDecode(text) {
    const payload = JSON.parse(text);
    if (!payload || payload.format !== 'npc_state_delta_chat_data') throw new Error('Not an NPC State Delta chat data file.');
    if (payload.formatVersion !== 1) throw new Error(`Unsupported NPC State Delta data file version: ${payload.formatVersion}.`);
    return payload;
}
export const viaV1 = (state) => decodeStateFilePayload(legacyEncodeV1('chat:v2', state)).state;
export const viaV2 = (state) => decodeStateFilePayload(encodeStateFilePayload('chat:v2', state, 't')).state;
export function firstDifference(a, b, path = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDifference(a[key], b[key], `${path}/${key}`); if (d) return d; }
    }
    return `${path}: ${JSON.stringify(a)?.slice(0, 80)} != ${JSON.stringify(b)?.slice(0, 80)}`;
}
// Reconcile stamps Date.now(); both routes must see the same clock for their results to be comparable.
export function atClock(fn) { const real = Date.now; Date.now = () => 1_800_000_000_000; try { return fn(); } finally { Date.now = real; } }
export const same = (a, b, note) => assert.equal(firstDifference(a, b), null, note);

export const msgU = text => ({ is_user: true, is_system: false, name: 'Kazuma', mes: text });
export const msgA = (text, swipe = 0) => ({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: swipe });

// A chat of `replies` exchanges built through the production checkpoint writers: two checkpoints per reply (the
// assistant-parent anchor and the scan), `npcCount` dossiers of about `noteChars` characters each that grow a little per reply.
export function buildChat(replies, { npcCount = 6, noteChars = 600, limit } = {}) {
    const chat = [];
    const state = { npcs: [], dismissed: [], inlineCards: [], checkpoints: [], lineage: [], portraitAssets: {}, formPortraitAssets: {}, branchLineageVersion: BRANCH_LINEAGE_VERSION, turn: 0, assistantSinceScan: 0, lastScanAt: 0, lastScannedMessageId: null, scanCount: 0 };
    for (let i = 0; i < npcCount; i += 1) {
        const npc = createNpcRecord(`Npc${i}`, state.npcs.map(n => n.id));
        npc.mannerisms = [`${'seed '.repeat(Math.ceil(noteChars / 5))}`.slice(0, noteChars)];
        state.npcs.push(npc);
    }
    for (let r = 0; r < replies; r += 1) {
        chat.push(msgU(`user turn ${r}`));
        ensureBranchParentAnchor(state, chat.concat(msgA(`reply ${r}`)), chat.length, 'assistant-parent', limit);
        chat.push(msgA(`reply ${r}`));
        state.turn += 1;
        const npc = state.npcs[r % npcCount];
        npc.relationship.trust = (npc.relationship.trust + 1) % 100;
        npc.mannerisms.push(`beat ${r} of ${npc.name}`);
        state.lastScannedMessageId = chat.length - 1;
        recordBranchCheckpoint(state, chat, chat.length - 1, 'scan', limit);
    }
    return { state, chat };
}

export function portraitState() {
    const { state } = buildChat(12);
    state.npcs[0].portrait = { dataUrl: 'data:image/png;base64,AAAA', seed: 7 };
    state.formPortraitAssets = { [state.npcs[1].id]: { alt: { dataUrl: 'data:image/png;base64,BBBB' } } };
    state.checkpoints.forEach(entry => { if (entry.snapshot.npcs?.[0]) entry.snapshot.npcs[0].portrait = null; });
    return state;
}
