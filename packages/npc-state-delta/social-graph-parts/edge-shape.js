/* NPC State Delta: the shape and normalization of one social edge or unresolved slot. */
import { clean, norm, slug, confidenceRank } from '../social-primitives.js';
import { socialRelationFamily, splitRelationDynamic, withFoldedDynamic, sanitizeRelationshipRelation, inverseSocialRelation } from '../social-relations.js';

// Normalization must be idempotent: Number(null) is 0, so an absent turn would otherwise become
// turn 0 on the next pass and no longer compare equal to its own snapshot.
export function optionalTurn(value) {
    if (value === null || value === undefined || value === '') return null;
    const turn = Number(value);
    return Number.isFinite(turn) ? turn : null;
}

export function edgeKey(edge) {
    const a = clean(edge?.aId, 100);
    const b = clean(edge?.bId, 100);
    const af = socialRelationFamily(edge?.aToB);
    const bf = socialRelationFamily(edge?.bToA);
    return `${a}|${b}|${af}|${bf}`;
}

export function normalizeEdge(raw = {}) {
    const aId = clean(raw.aId ?? raw.a_id, 100);
    const bId = clean(raw.bId ?? raw.b_id, 100);
    if (!aId || !bId || aId === bId) return null;
    const aSplit = splitRelationDynamic(raw.aToB ?? raw.a_to_b ?? raw.relation);
    const bSplit = splitRelationDynamic(raw.bToA ?? raw.b_to_a ?? raw.reverseRelation);
    const aToB = sanitizeRelationshipRelation('', aSplit.relation);
    let bToA = sanitizeRelationshipRelation('', bSplit.relation) || inverseSocialRelation(aToB);
    // A reverse side that repeats the forward text is a mirrored copy ("half-elf cousin" both ways);
    // keep it only when the relation is genuinely its own inverse.
    if (aToB && norm(bToA) === norm(aToB) && norm(inverseSocialRelation(aToB)) !== norm(aToB)) bToA = inverseSocialRelation(aToB);
    if (!aToB && !bToA) return null;
    const confidence = clean(raw.confidence, 40) || 'migration';
    return {
        id: clean(raw.id, 120) || `edge_${slug(`${aId}-${bId}-${socialRelationFamily(aToB)}-${socialRelationFamily(bToA)}`)}`,
        aId,
        bId,
        aToB,
        bToA,
        aDynamic: withFoldedDynamic(raw.aDynamic ?? raw.a_dynamic, aSplit.dynamic),
        bDynamic: withFoldedDynamic(raw.bDynamic ?? raw.b_dynamic, bSplit.dynamic),
        provenance: clean(raw.provenance, 40) || 'migration',
        confidence,
        reason: clean(raw.reason ?? raw.evidence, 300),
        sourceMessageId: Number.isInteger(raw.sourceMessageId) ? raw.sourceMessageId : null,
        turn: optionalTurn(raw.turn),
        groupId: clean(raw.groupId ?? raw.group_id, 120),
        sharedDescriptor: clean(raw.sharedDescriptor ?? raw.shared_descriptor, 120),
        inferred: raw.inferred === true && confidenceRank(confidence) < confidenceRank('explicit'),
    };
}

export function normalizeUnresolved(raw = {}) {
    const ownerId = clean(raw.ownerId ?? raw.owner_id, 100);
    const relation = clean(raw.relation, 180);
    if (!ownerId || !relation) return null;
    return {
        id: clean(raw.id, 120) || `slot_${slug(`${ownerId}-${relation}-${raw.groupId || ''}-${raw.slotIndex ?? ''}-${raw.descriptor || ''}`)}`,
        ownerId,
        relation,
        inverseRelation: clean(raw.inverseRelation ?? raw.inverse_relation, 180) || inverseSocialRelation(relation),
        groupId: clean(raw.groupId ?? raw.group_id, 120) || `group_${slug(`${ownerId}-${socialRelationFamily(relation)}`)}`,
        descriptor: clean(raw.descriptor, 180),
        sharedDescriptor: clean(raw.sharedDescriptor ?? raw.shared_descriptor, 180),
        provenance: clean(raw.provenance, 40) || 'migration',
        confidence: clean(raw.confidence, 40) || 'migration',
        reason: clean(raw.reason ?? raw.evidence, 300),
        sourceMessageId: Number.isInteger(raw.sourceMessageId) ? raw.sourceMessageId : null,
        turn: optionalTurn(raw.turn),
    };
}
