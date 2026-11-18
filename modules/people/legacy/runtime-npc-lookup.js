/* NPC State Delta NPC lookup: the tracked person of the loaded chat by id, or by id or name. */

import { normalizeName } from '../core/core.js';

export function createNpcLookupPart(deps) {
    const { chatHydrationStatus, getChatKey, getChatState } = deps;

    function currentNpcById(id) {
        if (chatHydrationStatus(getChatKey()) !== 'ready') return null;
        return getChatState().npcs.find(npc => npc.id === id) || null;
    }

    function findNpcByIdOrName(value) {
        const query = String(value || '').trim();
        if (!query || chatHydrationStatus(getChatKey()) !== 'ready') return null;
        const normalized = normalizeName(query);
        return getChatState().npcs.find(npc => npc.id === query || normalizeName(npc.name) === normalized) || null;
    }

    return { currentNpcById, findNpcByIdOrName };
}
