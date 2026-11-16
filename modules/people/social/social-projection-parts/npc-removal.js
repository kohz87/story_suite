/* Purging a removed NPC from other bonds and the graph, and listing graph labels.
   Part of social-projection.js; social-projection.js re-exports it. */

import { parseKeyRelationshipEntry } from '../social-bonds.js';
import { normalizeSocialGraph, npcLabels, relationFromPerspective } from '../social-graph.js';
import { clean, norm, uniq } from '../social-primitives.js';

export function purgeNpcStructuredReferences(npcs = [], removedNpc = null) {
    if (!removedNpc) return [];
    const labels = new Set([removedNpc.name, ...(removedNpc.aliases || [])].map(norm).filter(Boolean));
    const updated = [];
    for (const npc of npcs || []) {
        if (!npc || npc.id === removedNpc.id) continue;
        const before = JSON.stringify(npc.keyRelationships || []);
        npc.keyRelationships = (Array.isArray(npc.keyRelationships) ? npc.keyRelationships : []).filter(entry => {
            const parsed = parseKeyRelationshipEntry(entry);
            return !parsed || !labels.has(norm(parsed.subject));
        });
        if (JSON.stringify(npc.keyRelationships || []) !== before) updated.push(npc.id);
    }
    return updated;
}

export function removeNpcFromSocialGraph(rawGraph, npcId) {
    const graph = normalizeSocialGraph(rawGraph);
    const id = clean(npcId, 100);
    graph.edges = graph.edges.filter(edge => edge.aId !== id && edge.bId !== id);
    graph.unresolved = graph.unresolved.filter(slot => slot.ownerId !== id);
    return graph;
}

export function socialGraphLabelsForNpc(rawGraph, npcId, npcs = []) {
    const graph = normalizeSocialGraph(rawGraph);
    const labels = [];
    for (const edge of graph.edges) {
        const view = relationFromPerspective(edge, npcId);
        if (!view) continue;
        const counterpart = npcs.find(npc => npc?.id === view.counterpartId);
        if (counterpart) labels.push(...npcLabels(counterpart));
    }
    return uniq(labels);
}
