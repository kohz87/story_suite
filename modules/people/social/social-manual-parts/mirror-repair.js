/* Repairing bond text an earlier build mirrored whole onto the counterpart.
   Part of social-manual.js; social-manual.js re-exports it. */

import { formatKeyRelationship, parseKeyRelationshipEntry } from '../social-bonds.js';
import { resolveNpcReference } from '../social-graph.js';
import { clean, norm, uniq } from '../social-primitives.js';
import { KINSHIP_RELATION_FAMILIES, conflictingKinship, inverseSocialRelation, kinshipParts, socialRelationFamily } from '../social-relations.js';
import { establishedCounterpartRelation } from '../social-scan.js';

function speciesWords(npc) {
    return norm(npc?.species).split(/\s+/).filter(word => word.length >= 3);
}

function describesNpc(text, npc, other) {
    const words = norm(text).split(/\s+/);
    const own = speciesWords(npc);
    const others = new Set(speciesWords(other));
    return own.some(word => !others.has(word) && words.includes(word));
}

// Earlier builds mirrored a bond's whole text onto the counterpart, so both dossiers can hold the
// words one NPC uses about the other ("Hanna — disinherited half-elf cousin" on Talia). Decide
// which side the text describes and give the other side the proper inverse.
function repairMirroredKeyRelationships(npcs, graph) {
    const locked = npc => Array.isArray(npc?.manualProfileFields) && npc.manualProfileFields.includes('keyRelationships');
    const splitParts = value => value.split(/\s*\/\s*/).map(part => clean(part, 180)).filter(Boolean);
    const said = new Map();
    for (const owner of npcs) {
        if (!owner?.id) continue;
        const about = new Map();
        for (const raw of Array.isArray(owner.keyRelationships) ? owner.keyRelationships : []) {
            const parsed = parseKeyRelationshipEntry(raw);
            const target = parsed ? resolveNpcReference(npcs, parsed.subject) : null;
            if (target && target.id !== owner.id && !about.has(target.id)) about.set(target.id, parsed.relation);
        }
        said.set(owner.id, about);
    }
    const edges = new Map((graph.edges || []).map(edge => [[edge.aId, edge.bId].sort().join('|'), edge]));
    const byId = new Map(npcs.filter(npc => npc?.id).map(npc => [npc.id, npc]));
    const seen = new Set();
    for (const [ownerId, about] of said) {
        for (const [counterpartId, ownerText] of about) {
            const pairKey = [ownerId, counterpartId].sort().join('|');
            const counterpartText = said.get(counterpartId)?.get(ownerId);
            if (seen.has(pairKey) || !counterpartText) continue;
            seen.add(pairKey);
            const edge = edges.get(pairKey);
            const [a, b] = edge?.aId === counterpartId ? [byId.get(counterpartId), byId.get(ownerId)] : [byId.get(ownerId), byId.get(counterpartId)];
            const aText = a.id === ownerId ? ownerText : counterpartText;
            const bText = a.id === ownerId ? counterpartText : ownerText;
            const shared = splitParts(aText).filter(part => splitParts(bText).some(other => norm(other) === norm(part))
                && norm(inverseSocialRelation(part)) !== norm(part));
            if (!shared.length) continue;
            // The text belongs on the dossier of the NPC it does not describe. Otherwise the side that
            // holds extra parts absorbed the copy ("Niece / sibling" against a plain "niece"); failing
            // both, keep the side that established the edge.
            const aDescribed = shared.some(part => describesNpc(part, a, b));
            const bDescribed = shared.some(part => describesNpc(part, b, a));
            const aParts = splitParts(aText).length;
            const bParts = splitParts(bText).length;
            const copy = aDescribed !== bDescribed ? (aDescribed ? a : b) : (aParts !== bParts ? (aParts > bParts ? a : b) : b);
            const original = copy === a ? b : a;
            if (locked(copy)) continue;
            const sharedKeys = new Set(shared.map(norm));
            copy.keyRelationships = copy.keyRelationships.map(raw => {
                const parsed = parseKeyRelationshipEntry(raw);
                if (!parsed || resolveNpcReference(npcs, parsed.subject)?.id !== original.id) return raw;
                const relation = uniq(splitParts(parsed.relation)
                    .map(part => sharedKeys.has(norm(part)) ? inverseSocialRelation(part) : part)
                    .filter(Boolean)).join(' / ');
                return relation ? formatKeyRelationship(original.name, relation, parsed.dynamic, original) : '';
            }).filter(Boolean);
            if (!edge) continue;
            if (copy === a) edge.aToB = inverseSocialRelation(edge.bToA) || edge.aToB;
            else edge.bToA = inverseSocialRelation(edge.aToB) || edge.bToA;
        }
    }
    resolveConflictingKinship(npcs, said);
}

// An entry naming two different blood ties to one person ("Greta — niece / sibling") is settled by
// what that person's own dossier says ("Talia — niece" makes Greta the aunt). Without such a
// statement the entry is left as it is rather than guessed from word order.
function resolveConflictingKinship(npcs, said) {
    const locked = npc => Array.isArray(npc?.manualProfileFields) && npc.manualProfileFields.includes('keyRelationships');
    const byId = new Map(npcs.filter(npc => npc?.id).map(npc => [npc.id, npc]));
    for (const owner of npcs) {
        if (!owner?.id || locked(owner) || !said.has(owner.id)) continue;
        owner.keyRelationships = (Array.isArray(owner.keyRelationships) ? owner.keyRelationships : []).map(raw => {
            const parsed = parseKeyRelationshipEntry(raw);
            const counterpart = parsed ? resolveNpcReference(npcs, parsed.subject) : null;
            if (!counterpart || counterpart.id === owner.id) return raw;
            const parts = kinshipParts(parsed.relation);
            const kin = parts.filter(part => KINSHIP_RELATION_FAMILIES.has(socialRelationFamily(part)));
            if (!kin.some((part, i) => kin.slice(i + 1).some(other => conflictingKinship(part, other)))) return raw;
            const statement = establishedCounterpartRelation(byId.get(counterpart.id), owner, npcs);
            const stated = kinshipParts(statement).filter(part => KINSHIP_RELATION_FAMILIES.has(socialRelationFamily(part)));
            const statedFamilies = new Set(stated.map(socialRelationFamily));
            if (statedFamilies.size !== 1) return raw;
            const expected = inverseSocialRelation(stated[0]);
            const family = socialRelationFamily(kinshipParts(expected)[0]);
            const matching = kin.filter(part => socialRelationFamily(part) === family);
            const relation = uniq([
                ...parts.filter(part => !KINSHIP_RELATION_FAMILIES.has(socialRelationFamily(part))),
                ...(matching.length ? matching : [expected]),
            ]).join(' / ');
            return formatKeyRelationship(counterpart.name, relation, parsed.dynamic, counterpart);
        });
    }
}

export { speciesWords, describesNpc, repairMirroredKeyRelationships, resolveConflictingKinship };
