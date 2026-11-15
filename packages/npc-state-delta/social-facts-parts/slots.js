/* NPC State Delta: opens unresolved graph slots from unnamed facts and fills them from edges. */
import { clean, norm, slug, confidenceRank, SOCIAL_GRAPH_UNRESOLVED_LIMIT } from '../social-primitives.js';
import { socialRelationFamily, inverseSocialRelation } from '../social-relations.js';
import { relationFromPerspective, normalizeUnresolved } from '../social-graph.js';

export function collectiveDescriptorGrounded(value, descriptor) {
    const text = norm(value);
    const shared = norm(descriptor);
    if (!shared) return true;
    if (shared === 'twins' || shared === 'twin') return /\btwins?\b/.test(text);
    return text.includes(shared);
}

export function existingEdgeProvesCollectiveMembership(edge, ownerId, fact) {
    const view = relationFromPerspective(edge, ownerId);
    if (!view) return false;
    if (fact.sharedDescriptor && collectiveDescriptorGrounded(edge.sharedDescriptor, fact.sharedDescriptor)) return true;
    if (confidenceRank(edge.confidence) < confidenceRank('explicit')) return false;
    return collectiveDescriptorGrounded(`${view.relation} ${view.reverse} ${edge.reason}`, fact.sharedDescriptor);
}

export function ensureUnresolvedFacts(graph, facts = []) {
    for (const fact of facts) {
        const ownerId = clean(fact.ownerId, 100);
        const relation = clean(fact.relation, 180);
        if (!ownerId || !relation) continue;
        const family = socialRelationFamily(relation);
        const existingEdges = graph.edges.filter(edge => {
            const view = relationFromPerspective(edge, ownerId);
            return view && socialRelationFamily(view.relation) === family;
        });
        const existingResolved = existingEdges.length;
        const existingSlots = graph.unresolved.filter(slot => slot.ownerId === ownerId && socialRelationFamily(slot.relation) === family);
        const desiredOpen = Math.max(0, Number(fact.count || 0) - existingResolved);
        const toAdd = Math.max(0, desiredOpen - existingSlots.length);
        const groupId = existingSlots[0]?.groupId || `group_${slug(`${ownerId}-${family}-${fact.sharedDescriptor || ''}`)}`;
        if (!existingSlots.length && fact.count >= 2 && existingEdges.length === fact.count
            && existingEdges.every(edge => existingEdgeProvesCollectiveMembership(edge, ownerId, fact))) {
            for (const edge of existingEdges) {
                edge.groupId ||= groupId;
                if (fact.sharedDescriptor) edge.sharedDescriptor ||= fact.sharedDescriptor;
            }
        }
        for (let i = 0; i < toAdd; i += 1) {
            const slotIndex = existingSlots.length + i;
            const descriptor = clean(fact.descriptors?.[slotIndex] || '', 180);
            const slot = normalizeUnresolved({
                id: `slot_${slug(`${groupId}-${slotIndex + 1}`)}`,
                ownerId,
                relation,
                inverseRelation: inverseSocialRelation(relation),
                groupId,
                descriptor,
                sharedDescriptor: fact.sharedDescriptor,
                provenance: fact.provenance,
                confidence: fact.confidence,
                reason: fact.reason,
                sourceMessageId: fact.sourceMessageId,
                turn: fact.turn,
            });
            if (slot && graph.unresolved.length < SOCIAL_GRAPH_UNRESOLVED_LIMIT) graph.unresolved.push(slot);
        }
    }
}

export function resolveSlotsFromEdges(graph) {
    const remaining = [];
    for (const slot of graph.unresolved) {
        const candidates = graph.edges.filter(edge => {
            const view = relationFromPerspective(edge, slot.ownerId);
            return view && socialRelationFamily(view.relation) === socialRelationFamily(slot.relation);
        });
        const alreadyGrouped = new Set(graph.edges.filter(edge => edge.groupId === slot.groupId).map(edge => {
            const view = relationFromPerspective(edge, slot.ownerId);
            return view?.counterpartId || '';
        }).filter(Boolean));
        const available = candidates.filter(edge => {
            const view = relationFromPerspective(edge, slot.ownerId);
            return view && !alreadyGrouped.has(view.counterpartId);
        });
        let chosen = null;
        if (slot.descriptor) {
            chosen = available.find(edge => {
                const view = relationFromPerspective(edge, slot.ownerId);
                return norm(`${view?.relation || ''} ${view?.dynamic || ''}`).includes(norm(slot.descriptor));
            }) || null;
        }
        if (!chosen && available.length) chosen = available[0];
        if (!chosen) { remaining.push(slot); continue; }
        chosen.groupId ||= slot.groupId;
        chosen.sharedDescriptor ||= slot.sharedDescriptor;
    }
    graph.unresolved = remaining;
}
