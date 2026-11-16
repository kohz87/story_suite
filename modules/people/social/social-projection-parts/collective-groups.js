/* Matching a collective bond to the graph group it stands for and enriching it.
   Part of social-projection.js; social-projection.js re-exports it. */

import { relationFromPerspective } from '../social-graph.js';
import { norm, richer } from '../social-primitives.js';
import { collectiveRelationshipShape, socialRelationFamily } from '../social-relations.js';

function resolvedCollectiveGroup(ownerId, parsed, graph) {
    const shape = collectiveRelationshipShape(parsed);
    if (!shape) return null;
    const byGroup = new Map();
    for (const edge of graph.edges || []) {
        const view = relationFromPerspective(edge, ownerId);
        if (!view || socialRelationFamily(view.relation) !== shape.family || !edge.groupId) continue;
        if (shape.sharedDescriptor && norm(edge.sharedDescriptor) !== norm(shape.sharedDescriptor)) continue;
        const list = byGroup.get(edge.groupId) || [];
        if (!list.some(item => item.view.counterpartId === view.counterpartId)) list.push({ edge, view });
        byGroup.set(edge.groupId, list);
    }
    const matches = [...byGroup.entries()].filter(([groupId, members]) => {
        if (members.length !== shape.expectedCount) return false;
        return !(graph.unresolved || []).some(slot => slot.ownerId === ownerId && slot.groupId === groupId);
    });
    return matches.length === 1 ? { groupId: matches[0][0], members: matches[0][1] } : null;
}

function enrichCollectiveDynamic(ownerId, group, dynamic) {
    if (!group || !dynamic) return;
    for (const { edge } of group.members) {
        if (edge.aId === ownerId) edge.aDynamic = richer(edge.aDynamic, dynamic);
        else if (edge.bId === ownerId) edge.bDynamic = richer(edge.bDynamic, dynamic);
    }
}

export { resolvedCollectiveGroup, enrichCollectiveDynamic };
