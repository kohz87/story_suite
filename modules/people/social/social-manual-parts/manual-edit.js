/* Applying a manual Important Bond edit to the graph and the mirrored entries.
   Part of social-manual.js; social-manual.js re-exports it. */

import { formatKeyRelationship, parseKeyRelationshipEntry } from '../social-bonds.js';
import { addEdge, normalizeSocialGraph, pairConnects, relationFromPerspective, resolveNpcReference } from '../social-graph.js';
import { sharedParentBasis } from '../social-inference.js';
import { norm } from '../social-primitives.js';
import { inverseSocialRelation, kinshipParts, socialRelationFamily } from '../social-relations.js';
import { explicitReverseRelationship, relationshipCounterpartId, relationshipTargetsNpc } from './bond-lookup.js';

function removeMirroredRelationship(counterpart, owner, npcs = []) {
    if (!counterpart || !owner) return;
    counterpart.keyRelationships = (Array.isArray(counterpart.keyRelationships) ? counterpart.keyRelationships : [])
        .filter(entry => !relationshipTargetsNpc(entry, owner, npcs));
}

function replaceManualRelationshipEdge(graph, owner, parsed, npcs = [], meta = {}) {
    const counterpart = resolveNpcReference(npcs, parsed.subject);
    if (!counterpart || counterpart.id === owner.id) return null;
    const pairEdges = graph.edges.filter(edge => pairConnects(edge, owner.id, counterpart.id));
    const priorView = pairEdges.map(edge => relationFromPerspective(edge, owner.id)).find(Boolean) || null;
    const desiredReverse = inverseSocialRelation(parsed.relation);
    const explicitReverse = explicitReverseRelationship(counterpart, owner, npcs);
    const explicitReverseCompatible = explicitReverse
        && socialRelationFamily(explicitReverse.relation) === socialRelationFamily(desiredReverse);
    const priorReverseCompatible = priorView?.reverse
        && socialRelationFamily(priorView.reverse) === socialRelationFamily(desiredReverse);
    const reverseRelation = explicitReverseCompatible
        ? explicitReverse.relation
        : (priorReverseCompatible ? priorView.reverse : desiredReverse);
    const reverseDynamic = explicitReverseCompatible
        ? explicitReverse.dynamic
        : (priorReverseCompatible ? priorView.reverseDynamic : '');
    const priorEdge = pairEdges[0] || null;
    graph.edges = graph.edges.filter(edge => !pairConnects(edge, owner.id, counterpart.id));
    return addEdge(graph, {
        aId: owner.id,
        bId: counterpart.id,
        aToB: parsed.relation,
        bToA: reverseRelation,
        aDynamic: parsed.dynamic,
        bDynamic: reverseDynamic,
        provenance: 'manual',
        confidence: 'manual',
        reason: 'manual key relationship edit',
        sourceMessageId: meta.sourceMessageId,
        turn: meta.turn,
        groupId: priorEdge?.groupId || '',
        sharedDescriptor: priorEdge?.sharedDescriptor || '',
    });
}

export function applyManualKeyRelationshipEdit(state, npcId, beforeList = [], afterList = [], meta = {}) {
    const next = state && typeof state === 'object' ? state : {};
    const npcs = Array.isArray(next.npcs) ? next.npcs : [];
    const owner = npcs.find(npc => npc?.id === npcId);
    if (!owner) return next;
    let graph = normalizeSocialGraph(next.socialGraph);
    const beforeIds = new Set((beforeList || []).map(item => relationshipCounterpartId(npcs, item)).filter(Boolean));
    const afterEntries = (afterList || []).map(parseKeyRelationshipEntry).filter(Boolean);
    const afterIds = new Set((afterList || []).map(item => relationshipCounterpartId(npcs, item)).filter(Boolean));
    for (const removedId of beforeIds) {
        if (afterIds.has(removedId)) continue;
        const basis = sharedParentBasis(graph, owner.id, removedId);
        if (basis) {
            const [first, second] = [owner.id, removedId].sort();
            graph.suppressed = [...(graph.suppressed || []).filter(entry => !(entry.aId === first && entry.bId === second)), { aId: first, bId: second, basis }];
        }
        graph.edges = graph.edges.filter(edge => !pairConnects(edge, owner.id, removedId));
        const counterpart = npcs.find(npc => npc?.id === removedId);
        removeMirroredRelationship(counterpart, owner, npcs);
    }
    const beforeByCounterpart = new Map();
    for (const parsed of (beforeList || []).map(parseKeyRelationshipEntry).filter(Boolean)) {
        const id = resolveNpcReference(npcs, parsed.subject)?.id;
        if (id && !beforeByCounterpart.has(id)) beforeByCounterpart.set(id, parsed);
    }
    for (const parsed of afterEntries) {
        const counterpart = resolveNpcReference(npcs, parsed.subject);
        const previous = counterpart ? beforeByCounterpart.get(counterpart.id) : null;
        if (previous && norm(previous.relation) !== norm(parsed.relation)) syncMirroredRelationship(counterpart, owner, previous.relation, parsed.relation, npcs);
    }
    for (const parsed of afterEntries) replaceManualRelationshipEdge(graph, owner, parsed, npcs, meta);
    next.socialGraph = normalizeSocialGraph(graph);
    return next;
}

// A manual correction ("Marek — brother" instead of "parent") also corrects the counterpart's entry
// when that entry only mirrored the old relation ("Greta — child"), so it cannot restore the old one.
function syncMirroredRelationship(counterpart, owner, oldRelation, newRelation, npcs = []) {
    if (!counterpart || counterpart.id === owner.id) return;
    if (Array.isArray(counterpart.manualProfileFields) && counterpart.manualProfileFields.includes('keyRelationships')) return;
    const reverse = explicitReverseRelationship(counterpart, owner, npcs);
    const replacement = inverseSocialRelation(newRelation);
    if (!reverse || !replacement) return;
    const family = value => socialRelationFamily(kinshipParts(value)[0] || '');
    const mirroredOld = family(reverse.relation) && family(reverse.relation) === family(inverseSocialRelation(oldRelation));
    if (!mirroredOld || family(reverse.relation) === family(replacement)) return;
    counterpart.keyRelationships = counterpart.keyRelationships.map(entry => relationshipTargetsNpc(entry, owner, npcs)
        ? formatKeyRelationship(owner.name, replacement, reverse.dynamic, owner)
        : entry);
}

export { removeMirroredRelationship, replaceManualRelationshipEdge, syncMirroredRelationship };
