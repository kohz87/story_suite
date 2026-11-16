/* Canonicalizes each NPC's keyRelationships list: merges duplicate counterparts and drops redundant lines. */

import { clean, norm, richer, projectedTieLimit } from '../social-primitives.js';
import { preserveUnstructuredRelationshipText, mergeRelations } from '../social-relations.js';
import { parseKeyRelationshipEntry, formatKeyRelationship } from '../social-bonds.js';
import { resolveNpcReference } from '../social-graph.js';

export function canonicalizeNpcKeyRelationships(npcs = [], { includeLocked = false } = {}) {
    const updatedIds = [];
    const records = Array.isArray(npcs) ? npcs : [];
    for (const owner of records) {
        if (!owner) continue;
        if (!includeLocked && Array.isArray(owner.manualProfileFields) && owner.manualProfileFields.includes('keyRelationships')) continue;
        const entries = [];
        const byCounterpart = new Map();
        for (const raw of Array.isArray(owner.keyRelationships) ? owner.keyRelationships : []) {
            const parsed = parseKeyRelationshipEntry(raw);
            if (!parsed) {
                const fallback = clean(raw, 420);
                if (preserveUnstructuredRelationshipText(fallback)) entries.push(fallback);
                continue;
            }
            const counterpart = resolveNpcReference(records, parsed.subject);
            if (!counterpart || counterpart.id === owner.id) {
                entries.push(formatKeyRelationship(parsed.subject, parsed.relation, parsed.dynamic));
                continue;
            }
            const candidate = { counterpart, relation: parsed.relation, dynamic: parsed.dynamic };
            if (byCounterpart.has(counterpart.id)) {
                const existing = byCounterpart.get(counterpart.id);
                existing.relation = mergeRelations(existing.relation, candidate.relation);
                existing.dynamic = richer(existing.dynamic, candidate.dynamic);
            } else {
                byCounterpart.set(counterpart.id, candidate);
            }
        }
        for (const { counterpart, relation, dynamic } of byCounterpart.values()) entries.push(formatKeyRelationship(counterpart.name, relation, dynamic, counterpart));
        const structuredBodies = entries.map(parseKeyRelationshipEntry).filter(Boolean)
            .map(item => norm(`${item.relation} ${item.dynamic}`)).filter(Boolean);
        const deduped = [];
        const seen = new Set();
        for (const entry of entries) {
            const key = norm(entry);
            if (!entry || seen.has(key)) continue;
            const parsed = parseKeyRelationshipEntry(entry);
            if (!parsed && key.length >= 24 && structuredBodies.some(body => body.includes(key))) continue;
            seen.add(key);
            deduped.push(entry);
        }
        const before = JSON.stringify(owner.keyRelationships || []);
        owner.keyRelationships = deduped.slice(0, projectedTieLimit(owner));
        if (JSON.stringify(owner.keyRelationships) !== before) updatedIds.push(owner.id);
    }
    return updatedIds;
}
