/* Finding which NPC a bond entry names and its explicit reverse entry.
   Part of social-manual.js; social-manual.js re-exports it. */

import { parseKeyRelationshipEntry } from '../social-bonds.js';
import { npcLabels, resolveNpcReference } from '../social-graph.js';
import { clean, norm } from '../social-primitives.js';
import { relationshipSubjectLooksStructured } from '../social-relations.js';

function relationshipSubjectCandidate(value) {
    const text = clean(value, 420);
    if (!text) return '';
    const match = text.match(/^(.+?)(?:\s+[—–-]\s+|\s*:\s+)/);
    const subject = clean(match?.[1], 120);
    return relationshipSubjectLooksStructured(subject) ? subject : '';
}

function relationshipCounterpartId(npcs = [], value = '') {
    const parsed = parseKeyRelationshipEntry(value);
    const subject = parsed?.subject || relationshipSubjectCandidate(value);
    return resolveNpcReference(npcs, subject)?.id || '';
}

function relationshipTargetsNpc(value, target, npcs = []) {
    if (!target?.id) return false;
    const parsed = parseKeyRelationshipEntry(value);
    const subject = parsed?.subject || relationshipSubjectCandidate(value);
    if (!subject) return false;
    const resolved = resolveNpcReference(npcs, subject);
    if (resolved?.id === target.id) return true;
    const labels = new Set(npcLabels(target).map(norm).filter(Boolean));
    return labels.has(norm(subject));
}

function explicitReverseRelationship(counterpart, owner, npcs = []) {
    for (const raw of Array.isArray(counterpart?.keyRelationships) ? counterpart.keyRelationships : []) {
        const parsed = parseKeyRelationshipEntry(raw);
        if (!parsed) continue;
        const target = resolveNpcReference(npcs, parsed.subject);
        if (target?.id === owner.id) return parsed;
    }
    return null;
}

export { relationshipSubjectCandidate, relationshipCounterpartId, relationshipTargetsNpc, explicitReverseRelationship };
