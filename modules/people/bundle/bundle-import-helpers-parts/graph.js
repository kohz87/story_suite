// Imported social-graph reconciliation: slot rekeying and filtering the graph by valid ids.
import { normalizeSocialGraph } from '../../social/social.js';

// Unresolved slot and group ids are generated inside each source chat, so after the atomic id remap a
// coincident id can name a target slot that belongs to a different NPC. Such a collision does not
// make the slots the same relative: rekey the imported slot (and its group, with the imported edges
// that carry it) so both owners keep their count-aware continuity. Same-owner duplicates still merge.
export function rekeyCollidingImportedSlots(importedGraph, currentGraph) {
    const targetSlotOwner = new Map(currentGraph.unresolved.map(slot => [slot.id, slot.ownerId]));
    const targetGroupSlotOwners = new Map();
    for (const slot of currentGraph.unresolved) {
        if (!targetGroupSlotOwners.has(slot.groupId)) targetGroupSlotOwners.set(slot.groupId, new Set());
        targetGroupSlotOwners.get(slot.groupId).add(slot.ownerId);
    }
    // A named bond in a group has the owner on one end and the relative on the other, so it only
    // shows which NPCs the group may belong to; the relative end is not a competing owner.
    const targetGroupEdges = new Map();
    for (const edge of currentGraph.edges) {
        if (!edge.groupId) continue;
        if (!targetGroupEdges.has(edge.groupId)) targetGroupEdges.set(edge.groupId, []);
        targetGroupEdges.get(edge.groupId).push(edge);
    }
    const groupBelongsToOther = (groupId, ownerId) => {
        const slotOwners = targetGroupSlotOwners.get(groupId);
        if (slotOwners && [...slotOwners].some(owner => owner !== ownerId)) return true;
        const edges = targetGroupEdges.get(groupId) || [];
        return edges.length > 0 && !edges.some(edge => edge.aId === ownerId || edge.bId === ownerId);
    };
    const usedSlotIds = new Set([...targetSlotOwner.keys(), ...importedGraph.unresolved.map(slot => slot.id)]);
    const usedGroupIds = new Set([...targetGroupSlotOwners.keys(), ...targetGroupEdges.keys(), ...importedGraph.unresolved.map(slot => slot.groupId), ...importedGraph.edges.map(edge => edge.groupId).filter(Boolean)]);
    const unique = (base, used) => {
        let candidate = String(base).slice(0, 120);
        for (let n = 2; used.has(candidate); n += 1) candidate = `${String(base).slice(0, 112)}~${n}`;
        used.add(candidate);
        return candidate;
    };
    const groupRekey = new Map();
    const unresolved = importedGraph.unresolved.map(slot => {
        const next = { ...slot };
        if (groupBelongsToOther(slot.groupId, slot.ownerId)) {
            const groupKey = `${slot.groupId}|${slot.ownerId}`;
            if (!groupRekey.has(groupKey)) groupRekey.set(groupKey, unique(`${slot.groupId}~${slot.ownerId}`, usedGroupIds));
            next.groupId = groupRekey.get(groupKey);
        }
        if (targetSlotOwner.has(slot.id) && targetSlotOwner.get(slot.id) !== slot.ownerId) next.id = unique(`${slot.id}~${slot.ownerId}`, usedSlotIds);
        return next;
    });
    if (!groupRekey.size && unresolved.every((slot, index) => slot.id === importedGraph.unresolved[index].id)) return importedGraph;
    const edges = importedGraph.edges.map(edge => {
        if (!edge.groupId) return edge;
        const rekeyed = groupRekey.get(`${edge.groupId}|${edge.aId}`) || groupRekey.get(`${edge.groupId}|${edge.bId}`);
        return rekeyed ? { ...edge, groupId: rekeyed } : edge;
    });
    return normalizeSocialGraph({ ...importedGraph, edges, unresolved });
}

export function filterGraphByIds(graph, validIds, rejectedSourceIds = new Set()) {
    const normalized = normalizeSocialGraph(graph);
    return normalizeSocialGraph({
        edges: normalized.edges.filter(edge => !rejectedSourceIds.has(edge.aId)
            && !rejectedSourceIds.has(edge.bId)
            && validIds.has(edge.aId)
            && validIds.has(edge.bId)),
        unresolved: normalized.unresolved.filter(slot => !rejectedSourceIds.has(slot.ownerId) && validIds.has(slot.ownerId)),
        suppressed: (normalized.suppressed || []).filter(entry => !rejectedSourceIds.has(entry.aId)
            && !rejectedSourceIds.has(entry.bId)
            && validIds.has(entry.aId)
            && validIds.has(entry.bId)),
    });
}
