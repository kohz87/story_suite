// Small helpers shared by the branch-core parts: cloning an NPC list and reading an NPC's normalized labels.
import { normalizeName } from '../../core/core.js';

export function cloneNpcList(npcs) {
    return Array.isArray(npcs) ? structuredClone(npcs) : [];
}

export function npcLabels(npc) {
    return [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])]
        .map(normalizeName)
        .filter(Boolean);
}
