/* Reads the relation an NPC already has established with a counterpart and compares relation families. */

import { socialRelationFamily } from '../social-relations.js';
import { parseKeyRelationshipEntry } from '../social-bonds.js';
import { resolveNpcReference } from '../social-graph.js';

export function establishedCounterpartRelation(owner, counterpart, npcs = []) {
    if (!owner?.id || !counterpart?.id) return '';
    for (const raw of Array.isArray(owner.keyRelationships) ? owner.keyRelationships : []) {
        const parsed = parseKeyRelationshipEntry(raw);
        if (!parsed) continue;
        const target = resolveNpcReference(npcs, parsed.subject);
        if (target?.id === counterpart.id) return parsed.relation;
    }
    return '';
}

export function relationAgreement(established, candidate) {
    const establishedFamily = socialRelationFamily(established);
    const candidateFamily = socialRelationFamily(candidate);
    if (!establishedFamily || !candidateFamily) return 0;
    return establishedFamily === candidateFamily ? 1 : 0;
}
