/* NPC State Delta: adds an edge to a graph (merging or evicting) and reads an edge from one side. */
import { confidenceRank, richer, SOCIAL_GRAPH_EDGE_LIMIT } from '../social-primitives.js';
import { socialRelationFamily, mergeRelations } from '../social-relations.js';
import { edgeKey, normalizeEdge } from './edge-shape.js';

export function addEdge(graph, raw) {
    const edge = normalizeEdge(raw);
    if (!edge) return null;
    const key = edgeKey(edge);
    const index = graph.edges.findIndex(item => edgeKey(item) === key || (item.aId === edge.bId && item.bId === edge.aId
        && socialRelationFamily(item.aToB) === socialRelationFamily(edge.bToA)
        && socialRelationFamily(item.bToA) === socialRelationFamily(edge.aToB)));
    if (index >= 0) {
        const current = graph.edges[index];
        const reversed = current.aId === edge.bId && current.bId === edge.aId;
        const incomingAToB = reversed ? edge.bToA : edge.aToB;
        const incomingBToA = reversed ? edge.aToB : edge.bToA;
        const incomingADyn = reversed ? edge.bDynamic : edge.aDynamic;
        const incomingBDyn = reversed ? edge.aDynamic : edge.bDynamic;
        current.aToB = mergeRelations(current.aToB, incomingAToB);
        current.bToA = mergeRelations(current.bToA, incomingBToA);
        current.aDynamic = richer(current.aDynamic, incomingADyn);
        current.bDynamic = richer(current.bDynamic, incomingBDyn);
        if (confidenceRank(edge.confidence) >= confidenceRank(current.confidence)) {
            current.confidence = edge.confidence;
            current.provenance = edge.provenance;
            current.reason = edge.reason || current.reason;
            current.sourceMessageId = edge.sourceMessageId ?? current.sourceMessageId;
            current.turn = edge.turn ?? current.turn;
            current.inferred = edge.inferred;
        }
        current.groupId ||= edge.groupId;
        current.sharedDescriptor ||= edge.sharedDescriptor;
        return current;
    }
    if (graph.edges.length >= SOCIAL_GRAPH_EDGE_LIMIT) {
        const incomingRank = confidenceRank(edge.confidence);
        if (incomingRank <= confidenceRank('inferred')) return null;
        let evictionIndex = -1;
        let evictionRank = Infinity;
        for (let i = 0; i < graph.edges.length; i += 1) {
            const current = graph.edges[i];
            const rank = confidenceRank(current.confidence);
            if (rank >= incomingRank || rank >= evictionRank) continue;
            evictionRank = rank;
            evictionIndex = i;
        }
        // Capacity pressure may discard weaker inferred/migration continuity, but a new edge
        // never evicts an equal- or higher-authority explicit/manual relationship.
        if (evictionIndex < 0) return null;
        graph.edges.splice(evictionIndex, 1);
    }
    graph.edges.push(edge);
    return edge;
}

export function relationFromPerspective(edge, ownerId) {
    if (edge.aId === ownerId) return { counterpartId: edge.bId, relation: edge.aToB, dynamic: edge.aDynamic, reverse: edge.bToA, reverseDynamic: edge.bDynamic };
    if (edge.bId === ownerId) return { counterpartId: edge.aId, relation: edge.bToA, dynamic: edge.bDynamic, reverse: edge.aToB, reverseDynamic: edge.aDynamic };
    return null;
}

export function pairConnects(edge, aId, bId) {
    return (edge.aId === aId && edge.bId === bId) || (edge.aId === bId && edge.bId === aId);
}
