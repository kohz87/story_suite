// Enforcing the groups a reader dismissed on every list of a branch state.
import * as branchCore from '../branch-core.js';
import { normalizeName } from '../../core/core.js';
import { purgeNpcStructuredReferences, removeNpcFromSocialGraph } from '../../social/social.js';

function npcLabels(npc) {
    return [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(normalizeName).filter(Boolean);
}

export function enforceUserDismissals(state, groups) {
    const normalizedGroups = branchCore.normalizeUserDismissedGroups(groups);
    const blockedIds = new Set(normalizedGroups.flatMap(group => group.ids));
    const historicalBlockedLabels = new Set(normalizedGroups.filter(group => !group.ids.length).flatMap(group => group.labels));
    const modernBlockedLabels = new Set(normalizedGroups.filter(group => group.ids.length).flatMap(group => group.labels));
    state.userDismissedGroups = normalizedGroups;
    if (!blockedIds.size && !historicalBlockedLabels.size) return state;
    const blockedNpc = npc => blockedIds.has(String(npc?.id || '')) || npcLabels(npc).some(label => historicalBlockedLabels.has(label));
    const removedNpcs = (Array.isArray(state.npcs) ? state.npcs : []).filter(blockedNpc);
    state.npcs = (Array.isArray(state.npcs) ? state.npcs : []).filter(npc => !blockedNpc(npc));
    for (const removedNpc of removedNpcs) {
        state.socialGraph = removeNpcFromSocialGraph(state.socialGraph, removedNpc.id);
        purgeNpcStructuredReferences(state.npcs, removedNpc);
    }
    state.candidates = (Array.isArray(state.candidates) ? state.candidates : []).filter(candidate => {
        if (blockedIds.has(String(candidate?.id || ''))) return false;
        return !npcLabels(candidate).some(label => historicalBlockedLabels.has(label));
    });
    state.pendingBackfills = (Array.isArray(state.pendingBackfills) ? state.pendingBackfills : []).filter(item => {
        if (blockedIds.has(String(item?.npcId || ''))) return false;
        const label = normalizeName(item?.label);
        return !label || !historicalBlockedLabels.has(label);
    });
    const existingDismissed = (Array.isArray(state.dismissed) ? state.dismissed : [])
        .map(normalizeName)
        .filter(label => label && !modernBlockedLabels.has(label));
    state.dismissed = [...new Set([...existingDismissed, ...historicalBlockedLabels])];
    return state;
}
