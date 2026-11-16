/* Builds social edges from scanner output and from structured key relationships. */

import { clean, norm } from '../social-primitives.js';
import { inverseSocialRelation, splitRelationDynamic, withFoldedDynamic, sanitizeRelationshipRelation } from '../social-relations.js';
import { resolveNpcReference, npcLabels } from '../social-graph.js';
import { establishedCounterpartRelation, relationAgreement } from './established.js';

export function edgeDirectionGrounded(a, b, aToB, bToA, text = '') {
    const source = norm(text);
    if (!source) return 0;
    const aLabels = npcLabels(a).map(norm).filter(Boolean);
    const bLabels = npcLabels(b).map(norm).filter(Boolean);
    const aRel = norm(aToB);
    const bRel = norm(bToA);
    let givenScore = 0;
    let swappedScore = 0;
    for (const bName of bLabels) {
        for (const aName of aLabels) {
            if (aRel && (source.includes(`${bName} is ${aName}'s ${aRel}`)
                || source.includes(`${bName} is ${aName}s ${aRel}`)
                || source.includes(`${bName} is the ${aRel} of ${aName}`))) {
                givenScore += 2;
            }
            if (bRel && (source.includes(`${aName} is ${bName}'s ${bRel}`)
                || source.includes(`${aName} is ${bName}s ${bRel}`)
                || source.includes(`${aName} is the ${bRel} of ${bName}`))) {
                givenScore += 2;
            }
            if (bRel && (source.includes(`${bName} is ${aName}'s ${bRel}`)
                || source.includes(`${bName} is ${aName}s ${bRel}`)
                || source.includes(`${bName} is the ${bRel} of ${aName}`))) {
                swappedScore += 2;
            }
            if (aRel && (source.includes(`${aName} is ${bName}'s ${aRel}`)
                || source.includes(`${aName} is ${bName}s ${aRel}`)
                || source.includes(`${aName} is the ${aRel} of ${bName}`))) {
                swappedScore += 2;
            }
        }
    }
    return givenScore - swappedScore;
}

export function parseScanEdges(scanResult = {}, npcs = [], meta = {}) {
    const raw = scanResult?.keyRelationshipEdges ?? scanResult?.key_relationship_edges ?? scanResult?.socialRelationships ?? scanResult?.social_relationships ?? [];
    const out = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        const a = resolveNpcReference(npcs, item?.aId ?? item?.a_id ?? item?.a ?? item?.from ?? item?.source ?? '', meta);
        const b = resolveNpcReference(npcs, item?.bId ?? item?.b_id ?? item?.b ?? item?.to ?? item?.target ?? '', meta);
        if (!a || !b || a.id === b.id) continue;
        const aSplit = splitRelationDynamic(item?.aToB ?? item?.a_to_b ?? item?.fromTo ?? item?.from_to ?? item?.relation ?? item?.relationship);
        const bSplit = splitRelationDynamic(item?.bToA ?? item?.b_to_a ?? item?.toFrom ?? item?.to_from ?? item?.reverseRelation ?? item?.reverse_relation);
        let aToB = sanitizeRelationshipRelation(a.name, aSplit.relation);
        let bToA = sanitizeRelationshipRelation(b.name, bSplit.relation) || inverseSocialRelation(aToB);
        let aDynamic = withFoldedDynamic(item?.aDynamic ?? item?.a_dynamic ?? item?.fromDynamic ?? item?.dynamic, aSplit.dynamic);
        let bDynamic = withFoldedDynamic(item?.bDynamic ?? item?.b_dynamic ?? item?.toDynamic, bSplit.dynamic);
        if (!aToB && !bToA) continue;
        const aEstablished = establishedCounterpartRelation(a, b, npcs);
        const bEstablished = establishedCounterpartRelation(b, a, npcs);
        const asGiven = relationAgreement(aEstablished, aToB) + relationAgreement(bEstablished, bToA);
        const swapped = relationAgreement(aEstablished, bToA) + relationAgreement(bEstablished, aToB);
        const reasonText = clean(item?.reason ?? item?.evidence, 300);
        const edgeGrounded = edgeDirectionGrounded(a, b, aToB, bToA, reasonText || meta.developmentContext || '');
        if (swapped > asGiven && edgeGrounded <= 0) {
            [aToB, bToA] = [bToA, aToB];
            [aDynamic, bDynamic] = [bDynamic, aDynamic];
        }
        out.push({
            aId: a.id, bId: b.id, aToB, bToA,
            aDynamic, bDynamic,
            reason: reasonText || 'scanner social edge',
            provenance: meta.provenance || 'scanner', confidence: 'explicit', sourceMessageId: meta.sourceMessageId, turn: meta.turn,
        });
    }
    return out;
}

export function edgeFromKeyRelationship(owner, parsed, npcs, meta = {}) {
    const counterpart = resolveNpcReference(npcs, parsed.subject);
    if (!counterpart || counterpart.id === owner.id) return null;
    return {
        aId: owner.id,
        bId: counterpart.id,
        aToB: parsed.relation,
        bToA: inverseSocialRelation(parsed.relation),
        aDynamic: parsed.dynamic,
        provenance: meta.provenance || 'keyRelationships',
        confidence: meta.confidence || 'migration',
        reason: meta.reason || 'structured key relationship',
        sourceMessageId: meta.sourceMessageId,
        turn: meta.turn,
    };
}
