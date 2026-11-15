/* Aligns non-explicit graph edges with the relations the NPCs' keyRelationships already establish. */

import { inverseRelationFamilies, inverseSocialRelation } from '../social-relations.js';
import { normalizeSocialGraph } from '../social-graph.js';
import { establishedCounterpartRelation } from './established.js';

export function alignGraphWithCanonicalRelationships(graph, npcs = []) {
    for (const edge of graph.edges || []) {
        if (edge.confidence === 'explicit') continue;
        const a = npcs.find(npc => npc?.id === edge.aId);
        const b = npcs.find(npc => npc?.id === edge.bId);
        if (!a || !b) continue;
        const aEstablished = establishedCounterpartRelation(a, b, npcs);
        const bEstablished = establishedCounterpartRelation(b, a, npcs);
        if (aEstablished && inverseRelationFamilies(aEstablished, edge.aToB)) {
            edge.aToB = aEstablished;
            edge.bToA = bEstablished || inverseSocialRelation(aEstablished);
            continue;
        }
        if (bEstablished && inverseRelationFamilies(bEstablished, edge.bToA)) {
            edge.bToA = bEstablished;
            edge.aToB = aEstablished || inverseSocialRelation(bEstablished);
        }
    }
    return normalizeSocialGraph(graph);
}
