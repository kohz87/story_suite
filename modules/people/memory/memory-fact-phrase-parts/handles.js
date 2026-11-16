// Picking the pending facts whose source reply is in the prompt window, as numbered handles.
import { normalizeName } from '../../core-text.js';
import { MAX_HANDLES, MAX_ATTEMPTS } from './limits.js';
import { locked } from './shared-locked.js';

// Pending entries whose source reply is IN the exact window of the prompt: { h, npcId, key, R, fp, tk, rev, att }.
// `windowIds` are the message ids placed in the call's transcript; `fingerprintAt(id)` binds the message's content now.
export function selectHandles(npcs, windowIds, fingerprintAt) {
    const inWindow = new Set((Array.isArray(windowIds) ? windowIds : []).filter(Number.isInteger));
    if (!inWindow.size) return [];
    const rows = [];
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        if (!npc?.id || npc.archived || locked(npc)) continue;
        const pins = new Set((npc.manualMemories || []).map(normalizeName));
        for (const [key, entry] of Object.entries(npc.memoryFacts?.entries ?? {})) {
            if (!entry.pend || (entry.att ?? 0) >= MAX_ATTEMPTS || pins.has(entry.t) || !inWindow.has(entry.r)) continue;
            rows.push({ npcId: npc.id, key, R: entry.r, fp: fingerprintAt(entry.r), tk: entry.t, rev: entry.rev, att: entry.att ?? 0 });
        }
    }
    rows.sort((a, b) => a.R - b.R || (a.npcId < b.npcId ? -1 : (a.npcId > b.npcId ? 1 : 0)) || (a.key < b.key ? -1 : 1));
    const firstPerNpc = [];
    const seen = new Set();
    for (const row of rows) if (!seen.has(row.npcId)) { seen.add(row.npcId); firstPerNpc.push(row); }
    const picked = [...firstPerNpc, ...rows.filter(row => !firstPerNpc.includes(row))].slice(0, MAX_HANDLES);
    return picked.map((row, index) => ({ ...row, h: `h${index + 1}` }));
}
