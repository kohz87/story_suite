/* Projecting the social graph into each NPC's Important Bonds list.
   Part of social-projection.js; social-projection.js re-exports it. */

import { formatKeyRelationship, parseKeyRelationshipEntry } from '../social-bonds.js';
import { relationFromPerspective, resolveNpcReference } from '../social-graph.js';
import { clean, confidenceRank, projectedTieLimit, richer } from '../social-primitives.js';
import { conflictingKinship, inverseRelationFamilies, mergeRelations, preserveUnstructuredRelationshipText, socialRelationFamily } from '../social-relations.js';
import { enrichCollectiveDynamic, resolvedCollectiveGroup } from './collective-groups.js';

function projectGraphToKeyRelationships(npcs, graph) {
    const updatedIds = [];
    for (const owner of npcs || []) {
        if (!owner || (Array.isArray(owner.manualProfileFields) && owner.manualProfileFields.includes('keyRelationships'))) continue;
        const existingParsed = [];
        const unresolvedText = [];
        for (const entry of Array.isArray(owner.keyRelationships) ? owner.keyRelationships : []) {
            const parsed = parseKeyRelationshipEntry(entry);
            if (!parsed) {
                const fallback = clean(entry, 420);
                if (preserveUnstructuredRelationshipText(fallback)) unresolvedText.push(fallback);
                continue;
            }
            const counterpart = resolveNpcReference(npcs, parsed.subject);
            if (!counterpart || counterpart.id === owner.id) {
                const collective = resolvedCollectiveGroup(owner.id, parsed, graph);
                if (collective) {
                    enrichCollectiveDynamic(owner.id, collective, parsed.dynamic);
                    continue;
                }
                unresolvedText.push(formatKeyRelationship(parsed.subject, parsed.relation, parsed.dynamic));
            } else existingParsed.push({ counterpartId: counterpart.id, relation: parsed.relation, dynamic: parsed.dynamic, score: 100, own: true });
        }
        const byCounterpart = new Map(existingParsed.map(item => [item.counterpartId, item]));
        for (const edge of graph.edges) {
            const view = relationFromPerspective(edge, owner.id);
            if (!view) continue;
            const counterpart = npcs.find(npc => npc?.id === view.counterpartId);
            if (!counterpart) continue;
            const score = (counterpart.present ? 40 : 0) + (counterpart.worldActive ? 10 : 0) + (counterpart.lifeState === 'deceased' ? 3 : 0) + confidenceRank(edge.confidence) * 3;
            if (byCounterpart.has(counterpart.id)) {
                const item = byCounterpart.get(counterpart.id);
                if (edge.confidence === 'explicit' && inverseRelationFamilies(socialRelationFamily(item.relation), socialRelationFamily(view.relation))) {
                    item.relation = view.relation;
                } else if (item.own && conflictingKinship(item.relation, view.relation)) {
                    // A blood tie mirrored from the other side never overrides this NPC's own
                    // statement; a wrong entry on one dossier must not spread to the other.
                } else {
                    item.relation = mergeRelations(item.relation, view.relation);
                }
                item.dynamic = richer(item.dynamic, view.dynamic);
                item.score = Math.max(item.score, score);
            } else byCounterpart.set(counterpart.id, { counterpartId: counterpart.id, relation: view.relation, dynamic: view.dynamic, score });
        }
        const rendered = [...byCounterpart.values()]
            .sort((a, b) => b.score - a.score)
            .map(item => {
                const counterpart = npcs.find(npc => npc?.id === item.counterpartId);
                return counterpart ? formatKeyRelationship(counterpart.name, item.relation, item.dynamic, counterpart) : '';
            }).filter(Boolean);
        const next = [...unresolvedText, ...rendered].filter(Boolean).slice(0, projectedTieLimit(owner));
        const before = JSON.stringify(owner.keyRelationships || []);
        owner.keyRelationships = next;
        if (JSON.stringify(next) !== before) updatedIds.push(owner.id);
    }
    return updatedIds;
}

export { projectGraphToKeyRelationships };
