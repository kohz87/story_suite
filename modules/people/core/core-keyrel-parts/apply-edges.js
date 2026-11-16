/* NPC State Delta edge application: writing normalized key-relationship edges into the people they name. */
import { compactSocialKeyRelationship, SOCIAL_DYNAMIC_MAX_CHARS } from '../../social.js';
import { cleanText, cleanTextBoundary, normalizeName } from '../../core-text.js';
import { keyRelationshipSubjectsEquivalent, mergeKeyRelationshipUpdates } from './merge.js';
import { normalizeKeyRelationshipEdges, relationshipEdgeNpc } from './edges.js';

function relationshipEdgeEntry(counterpart, relation, dynamic = '') {
    const who = cleanTextBoundary(counterpart, 120, { ellipsis: false });
    const rel = cleanTextBoundary(relation, 180, { ellipsis: false });
    const current = cleanTextBoundary(dynamic, SOCIAL_DYNAMIC_MAX_CHARS);
    if (!who || !rel) return '';
    return compactSocialKeyRelationship(`${who} — ${rel}${current ? ` | ${current}` : ''}`);
}

export function applyKeyRelationshipEdges(next, scanResult, excludeNames, report, options = {}) {
    const edges = normalizeKeyRelationshipEdges(scanResult);
    if (!edges.length) return;
    const excluded = excludeNames instanceof Set ? excludeNames : new Set();
    const applyOne = (owner, counterpart, relation, dynamic, reason) => {
        if (!owner || !counterpart || !relation) return;
        if (excluded.has(normalizeName(counterpart))) return;
        if ((owner.manualProfileFields || []).includes('keyRelationships')) return;
        const entry = relationshipEdgeEntry(counterpart, relation, dynamic);
        if (!entry) return;
        // (ONEPASSCAPR2-4) A terse ungrounded edge on the same scan cannot erase an accepted detailed row.
        const ownRow = (scanResult.npcs || []).find(row => (row.id && row.id === owner.id) || normalizeName(row.name) === normalizeName(owner.name));
        const ties = typeof ownRow?.keyRelationships === 'string' ? ownRow.keyRelationships.split(/\r?\n/) : ownRow?.keyRelationships;
        if (!options.historicalRead && !reason && !dynamic && Array.isArray(ties) && ties.some(tie => keyRelationshipSubjectsEquivalent(tie, entry))) return;
        const before = JSON.stringify(owner.keyRelationships || []);
        owner.keyRelationships = mergeKeyRelationshipUpdates(owner.keyRelationships, [entry]);
        if (JSON.stringify(owner.keyRelationships || []) !== before && !report.updated.includes(owner.id)) report.updated.push(owner.id);
    };
    for (const edge of edges) {
        const aNpc = relationshipEdgeNpc(next.npcs, edge.aId, edge.a, options.historicalRead);
        const bNpc = relationshipEdgeNpc(next.npcs, edge.bId, edge.b, options.historicalRead);
        const ambiguous = label => label && next.npcs.filter(npc => [npc?.name, ...(npc?.aliases || [])].some(value => normalizeName(value) === normalizeName(label))).length > 1;
        if (!options.historicalRead && ((!aNpc && ambiguous(edge.a)) || (!bNpc && ambiguous(edge.b)))) continue;
        // (ONEPASSCAP-3) An unresolved endpoint that is an id ("npc_nobody") names no one: it is never written as a tie's name.
        const aName = cleanText(aNpc?.name || (!options.historicalRead && /^npc_/i.test(edge.a) ? '' : edge.a), 120);
        const bName = cleanText(bNpc?.name || (!options.historicalRead && /^npc_/i.test(edge.b) ? '' : edge.b), 120);
        if (aNpc && bName && edge.aToB) applyOne(aNpc, bName, edge.aToB, edge.aDynamic, edge.reason);
        if (bNpc && aName && edge.bToA) applyOne(bNpc, aName, edge.bToA, edge.bDynamic, edge.reason);
    }
}
