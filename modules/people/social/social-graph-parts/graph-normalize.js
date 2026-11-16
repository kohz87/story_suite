/* NPC State Delta: normalizes a whole social graph (edges, unresolved slots, suppressed pairs). */
import {
    clean, confidenceRank, richer,
    SOCIAL_GRAPH_VERSION, SOCIAL_GRAPH_EDGE_LIMIT,
    SOCIAL_GRAPH_UNRESOLVED_LIMIT, SOCIAL_GRAPH_SUPPRESSED_LIMIT,
} from '../social-primitives.js';
import { socialRelationFamily, mergeRelations } from '../social-relations.js';
import { edgeKey, normalizeEdge, normalizeUnresolved } from './edge-shape.js';

export function normalizeSocialGraph(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const edges = [];
    const edgeIndex = new Map();
    const sourceEdges = (Array.isArray(source.edges) ? source.edges : [])
        .map((item, index) => ({ item, index }))
        .sort((a, b) => Number(Boolean(a.item?.inferred)) - Number(Boolean(b.item?.inferred))
            || confidenceRank(b.item?.confidence) - confidenceRank(a.item?.confidence)
            || a.index - b.index)
        .map(entry => entry.item);
    for (const item of sourceEdges) {
        const edge = normalizeEdge(item);
        if (!edge) continue;
        const key = edgeKey(edge);
        // The same shared pair stored in the opposite orientation is one edge (as in addEdge), and
        // must merge before the capacity check rather than take a unique edge's slot.
        const reverseKey = `${edge.bId}|${edge.aId}|${socialRelationFamily(edge.bToA)}|${socialRelationFamily(edge.aToB)}`;
        const existingIndex = edgeIndex.has(key) ? edgeIndex.get(key) : edgeIndex.get(reverseKey);
        if (existingIndex !== undefined) {
            const current = edges[existingIndex];
            const reversed = current.aId !== edge.aId;
            current.aToB = mergeRelations(current.aToB, reversed ? edge.bToA : edge.aToB);
            current.bToA = mergeRelations(current.bToA, reversed ? edge.aToB : edge.bToA);
            current.aDynamic = richer(current.aDynamic, reversed ? edge.bDynamic : edge.aDynamic);
            current.bDynamic = richer(current.bDynamic, reversed ? edge.aDynamic : edge.bDynamic);
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
            continue;
        }
        edgeIndex.set(key, edges.length);
        edges.push(edge);
        if (edges.length >= SOCIAL_GRAPH_EDGE_LIMIT) break;
    }
    const unresolved = [];
    const unresolvedSeen = new Set();
    for (const item of Array.isArray(source.unresolved) ? source.unresolved : []) {
        const slot = normalizeUnresolved(item);
        if (!slot || unresolvedSeen.has(slot.id)) continue;
        unresolvedSeen.add(slot.id);
        unresolved.push(slot);
        if (unresolved.length >= SOCIAL_GRAPH_UNRESOLVED_LIMIT) break;
    }
    // Pairs a user removed by hand that inference must not recreate from the same evidence.
    // At capacity the oldest removals give way: the newest entries are last, and dropping one just
    // made would let inference recreate the bond the user just deleted.
    const suppressed = [];
    for (const item of (Array.isArray(source.suppressed) ? source.suppressed : []).slice().reverse()) {
        const aId = clean(item?.aId, 100);
        const bId = clean(item?.bId, 100);
        if (!aId || !bId || aId === bId) continue;
        const [first, second] = [aId, bId].sort();
        const basis = clean(item?.basis, 400);
        if (suppressed.some(entry => entry.aId === first && entry.bId === second && entry.basis === basis)) continue;
        suppressed.push({ aId: first, bId: second, basis });
        if (suppressed.length >= SOCIAL_GRAPH_SUPPRESSED_LIMIT) break;
    }
    suppressed.reverse();
    return suppressed.length ? { version: SOCIAL_GRAPH_VERSION, edges, unresolved, suppressed } : { version: SOCIAL_GRAPH_VERSION, edges, unresolved };
}
