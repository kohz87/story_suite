/* NPC State Delta key-relationship edges: normalizing raw edges from a scan result and finding the person an edge endpoint names. */
import { resolveNpcId, resolveNpcReference, SOCIAL_DYNAMIC_MAX_CHARS } from '../../social/social.js';
import { cleanText, cleanTextBoundary, normalizeName } from '../core-text.js';

function normalizeKeyRelationshipEdge(raw = {}) {
    const aId = cleanText(raw.aId ?? raw.a_id ?? raw.fromId ?? raw.from_id ?? raw.sourceId ?? raw.source_id, 100);
    const bId = cleanText(raw.bId ?? raw.b_id ?? raw.toId ?? raw.to_id ?? raw.targetId ?? raw.target_id, 100);
    const a = cleanText(raw.a ?? raw.from ?? raw.source ?? raw.personA ?? raw.person_a, 120);
    const b = cleanText(raw.b ?? raw.to ?? raw.target ?? raw.personB ?? raw.person_b, 120);
    const aToB = cleanTextBoundary(raw.aToB ?? raw.a_to_b ?? raw.fromTo ?? raw.from_to ?? raw.relation ?? raw.relationship, 180, { ellipsis: false });
    const bToA = cleanTextBoundary(raw.bToA ?? raw.b_to_a ?? raw.toFrom ?? raw.to_from ?? raw.reverseRelation ?? raw.reverse_relation, 180, { ellipsis: false });
    const aDynamic = cleanTextBoundary(raw.aDynamic ?? raw.a_dynamic ?? raw.fromDynamic ?? raw.from_dynamic ?? raw.dynamic, SOCIAL_DYNAMIC_MAX_CHARS);
    const bDynamic = cleanTextBoundary(raw.bDynamic ?? raw.b_dynamic ?? raw.toDynamic ?? raw.to_dynamic, SOCIAL_DYNAMIC_MAX_CHARS);
    const reason = cleanText(raw.reason ?? raw.evidence, 300);
    if ((!a && !aId) || (!b && !bId) || (!aToB && !bToA)) return null;
    return { aId, a, bId, b, aToB, bToA, aDynamic, bDynamic, reason };
}

export function normalizeKeyRelationshipEdges(scanResult = {}) {
    const raw = scanResult?.keyRelationshipEdges
        ?? scanResult?.key_relationship_edges
        ?? scanResult?.socialRelationships
        ?? scanResult?.social_relationships
        ?? [];
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        const edge = normalizeKeyRelationshipEdge(item);
        if (!edge) continue;
        const key = [edge.aId || normalizeName(edge.a), edge.bId || normalizeName(edge.b), normalizeName(edge.aToB), normalizeName(edge.bToA)].join('|');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(edge);
        if (out.length >= 12) break;
    }
    return out;
}

// (ONEPASSCAP-3) An endpoint is its id, then its label read as an id (a `from`/`to` that holds "npc_sieke"), each exact or folded
// (resolveNpcId), then its label as a name or alias as before.
export function relationshipEdgeNpc(npcs, id, label, historicalRead = false) {
    const list = Array.isArray(npcs) ? npcs : [];
    if (historicalRead) return list.find(npc => id && npc?.id === id)
        || list.find(npc => label && [npc?.name, ...(npc?.aliases || [])].some(value => normalizeName(value) === normalizeName(label))) || null;
    for (const ref of [cleanText(id, 100), cleanText(label, 120)]) {
        const byId = ref ? resolveNpcId(list, ref) : null;
        if (byId) return byId;
    }
    return resolveNpcReference(list, label); // (ONEPASSCAPR2-5) an alias must identify exactly one dossier
}
