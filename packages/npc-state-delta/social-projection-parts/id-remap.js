/* Renaming NPC ids across the graph, singly or as a whole map.
   Part of social-projection.js; social-projection.js re-exports it. */

import { normalizeSocialGraph } from '../social-graph.js';
import { clean } from '../social-primitives.js';

// Apply a whole old-to-new id map in one pass. Renaming one id at a time (with normalization in
// between) breaks permutations: swapping A and B first merges them into a self-edge that is dropped.
export function remapSocialGraphNpcIds(rawGraph, idMap) {
    const graph = normalizeSocialGraph(rawGraph);
    const map = new Map([...(idMap instanceof Map ? idMap.entries() : Object.entries(idMap || {}))]
        .map(([from, to]) => [clean(from, 100), clean(to, 100)])
        .filter(([from, to]) => from && to && from !== to));
    if (!map.size) return graph;
    const remap = id => (map.has(id) ? map.get(id) : id);
    for (const edge of graph.edges) {
        edge.aId = remap(edge.aId);
        edge.bId = remap(edge.bId);
    }
    for (const slot of graph.unresolved) slot.ownerId = remap(slot.ownerId);
    for (const entry of graph.suppressed || []) {
        entry.aId = remap(entry.aId);
        entry.bId = remap(entry.bId);
        entry.basis = String(entry.basis || '').split(',').filter(Boolean).map(remap).sort().join(',');
    }
    return normalizeSocialGraph(graph);
}

export function remapSocialGraphNpcId(rawGraph, fromId, toId) {
    const graph = normalizeSocialGraph(rawGraph);
    const from = clean(fromId, 100); const to = clean(toId, 100);
    if (!from || !to || from === to) return graph;
    for (const edge of graph.edges) {
        if (edge.aId === from) edge.aId = to;
        if (edge.bId === from) edge.bId = to;
    }
    for (const slot of graph.unresolved) if (slot.ownerId === from) slot.ownerId = to;
    for (const entry of graph.suppressed || []) {
        if (entry.aId === from) entry.aId = to;
        if (entry.bId === from) entry.bId = to;
        // The basis lists the shared parents' ids.
        entry.basis = String(entry.basis || '').split(',').filter(Boolean).map(id => (id === from ? to : id)).sort().join(',');
    }
    return normalizeSocialGraph(graph);
}
