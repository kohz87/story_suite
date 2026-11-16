// Public stale-NPC lifecycle: mechanics plus social-graph and structured-reference cleanup for removed NPCs.
import * as mechanics from '../core-mechanics.js';
import { removeNpcFromSocialGraph, purgeNpcStructuredReferences } from '../social.js';

export function applyStaleNpcLifecycle(state = {}, options = {}) {
    const beforeNpcs = new Map((Array.isArray(state?.npcs) ? state.npcs : [])
        .filter(npc => npc?.id)
        .map(npc => [String(npc.id), structuredClone(npc)]));
    const result = mechanics.applyStaleNpcLifecycle(state, options);
    const removed = Array.isArray(result?.removed) ? result.removed : [];
    if (!removed.length) return result;

    // Complete stale-removal cleanup at the public mechanics facade while preserving
    // portrait bytes until branch/history pruning proves the NPC is no longer rollback-reachable.
    const next = result.state;
    for (const item of removed) {
        const id = String(item?.id || '');
        if (!id) continue;
        next.socialGraph = removeNpcFromSocialGraph(next.socialGraph, id);
        const removedNpc = beforeNpcs.get(id);
        if (removedNpc) purgeNpcStructuredReferences(next.npcs, removedNpc);
    }
    if (state?.portraitAssets && typeof state.portraitAssets === 'object') {
        next.portraitAssets = { ...structuredClone(state.portraitAssets), ...(next.portraitAssets || {}) };
    }
    return result;
}
