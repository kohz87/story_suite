// Holding a key person's stable fields still while they are away, for one scan's merge.

import { AWAY_LOCKED_FIELDS } from './constants.js';

// ---- holding a key person's stable fields still while they are away ----

/**
 * The state with the away key people's stable profile fields and custom fields locked, for one scan's merge:
 * { state, restore(npcs) } — `restore` puts each locked dossier's own lock list back, so nothing of this
 * is stored. Null when nobody is away (the merge then runs on the state itself).
 */
export function lockAwayNpcs(state, ids) {
    const away = ids instanceof Set ? ids : new Set(Array.isArray(ids) ? ids.map(String) : []);
    if (!away.size || !Array.isArray(state?.npcs)) return null;
    const saved = new Map();
    const npcs = state.npcs.map(npc => {
        const id = npc?.id ? String(npc.id) : '';
        if (!id || !away.has(id)) return npc;
        const own = Array.isArray(npc.manualProfileFields) ? [...npc.manualProfileFields] : [];
        saved.set(id, own);
        return { ...npc, manualProfileFields: [...new Set([...own, ...AWAY_LOCKED_FIELDS])] };
    });
    if (!saved.size) return null;
    return {
        state: { ...state, npcs },
        restore: list => (Array.isArray(list) ? list : []).map(npc => {
            const own = saved.get(npc?.id ? String(npc.id) : '');
            return own ? { ...npc, manualProfileFields: [...own] } : npc;
        }),
    };
}
