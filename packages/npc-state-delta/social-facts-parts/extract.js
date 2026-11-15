/* NPC State Delta: reads explicit unnamed social facts (counted siblings, children) from a transcript and the dossiers. */
import { clean, norm } from '../social-primitives.js';
import { socialRelationFamily, numberWord, singularRelation, collectiveRelationshipShape } from '../social-relations.js';
import { parseKeyRelationshipEntry } from '../social-bonds.js';
import { npcLabels } from '../social-graph.js';

export function extractUnresolvedSocialFacts(transcript, npcs = [], meta = {}) {
    const text = clean(transcript, 12000);
    const facts = [];
    const seen = new Set();
    const pushFact = (owner, count, relation, sharedDescriptor = '', descriptors = [], reason = '') => {
        const n = Math.max(1, Math.min(20, Number(count) || 1));
        const rel = singularRelation(relation);
        if (!owner?.id || !rel) return;
        const key = `${owner.id}|${socialRelationFamily(rel)}|${n}|${norm(sharedDescriptor)}`;
        if (seen.has(key)) return;
        seen.add(key);
        facts.push({ ownerId: owner.id, count: n, relation: rel, sharedDescriptor, descriptors, reason: reason || 'explicit unnamed social relation', provenance: meta.provenance || 'transcript', confidence: 'explicit', sourceMessageId: meta.sourceMessageId, turn: meta.turn });
    };
    const countToken = String.raw`(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)`;
    const pluralRel = String.raw`(daughters|sons|children|sisters|brothers|siblings)`;
    for (const npc of npcs || []) {
        for (const label of npcLabels(npc).slice(0, 6)) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const countedPatterns = [
                new RegExp(`${escaped}\\s+(?:has|had|raises?|cares\\s+for)\\s+${countToken}\\s+(twin\\s+)?${pluralRel}\\b`, 'giu'),
                new RegExp(`${escaped}(?:['’]s|['’])\\s+${countToken}\\s+(twin\\s+)?${pluralRel}\\b`, 'giu'),
                new RegExp(`${escaped}\\s+(?:is|was|remains)?\\s*(?:the\\s+)?(?:mother|father|parent|guardian)\\s+of\\s+${countToken}\\s+(twin\\s+)?${pluralRel}\\b`, 'giu'),
                new RegExp(`${escaped}\\s*,\\s*(?:the\\s+)?(?:mother|father|parent|guardian)\\s+of\\s+${countToken}\\s+(twin\\s+)?${pluralRel}\\b`, 'giu'),
            ];
            for (const pattern of countedPatterns) {
                for (const match of text.matchAll(pattern)) {
                    const count = numberWord(match[1]);
                    const twin = Boolean(match[2]);
                    const matchStart = Number(match.index || 0);
                    const matchEnd = matchStart + match[0].length;
                    const priorBoundary = Math.max(text.lastIndexOf('.', matchStart - 1), text.lastIndexOf('!', matchStart - 1), text.lastIndexOf('?', matchStart - 1));
                    const tail = text.slice(matchEnd);
                    const nextBoundaryRel = tail.search(/[.!?]/);
                    const sentenceEnd = nextBoundaryRel >= 0 ? matchEnd + nextBoundaryRel + 1 : Math.min(text.length, matchEnd + 120);
                    const local = text.slice(priorBoundary + 1, sentenceEnd);
                    const descriptors = count === 2 && /\bolder\b/i.test(local) && /\byounger\b/i.test(local) ? ['older', 'younger'] : [];
                    pushFact(npc, count, match[3], twin ? 'twins' : '', descriptors, match[0]);
                }
            }
            const twinOnly = [
                new RegExp(`${escaped}\\s+(?:has|had|raises?|cares\\s+for)\\s+twin\\s+${pluralRel}\\b`, 'giu'),
                new RegExp(`${escaped}(?:['’]s|['’])\\s+twin\\s+${pluralRel}\\b`, 'giu'),
            ];
            for (const pattern of twinOnly) {
                for (const match of text.matchAll(pattern)) pushFact(npc, 2, match[1], 'twins', [], match[0]);
            }
            const singular = String.raw`(daughter|son|child|sister|brother|sibling)`;
            const singularPatterns = [
                new RegExp(`${escaped}\\s+(?:has|had|raises?|cares\\s+for)\\s+(?:a|an|one)\\s+${singular}\\b`, 'giu'),
                new RegExp(`${escaped}(?:['’]s|['’])\\s+${singular}\\b`, 'giu'),
            ];
            for (const pattern of singularPatterns) {
                for (const match of text.matchAll(pattern)) pushFact(npc, 1, match[1], '', [], match[0]);
            }
        }
        const background = clean(npc?.background, 1200);
        if (background) {
            const family = background.match(new RegExp(`\\b(?:mother|father|parent|guardian)\\s+of\\s+${countToken}\\s+(twin\\s+)?${pluralRel}\\b`, 'iu'));
            if (family) pushFact(npc, numberWord(family[1]), family[3], family[2] ? 'twins' : '', [], family[0]);
            const twinFamily = background.match(new RegExp(`\\b(?:mother|father|parent|guardian)\\s+of\\s+twin\\s+${pluralRel}\\b`, 'iu'));
            if (twinFamily) pushFact(npc, 2, twinFamily[1], 'twins', [], twinFamily[0]);
            const singleFamily = background.match(/\\b(?:mother|father|parent|guardian)\\s+of\\s+(?:a|an|one)\\s+(daughter|son|child)\\b/iu);
            if (singleFamily) pushFact(npc, 1, singleFamily[1], '', [], singleFamily[0]);
        }
        for (const raw of Array.isArray(npc?.keyRelationships) ? npc.keyRelationships : []) {
            const parsed = parseKeyRelationshipEntry(raw);
            if (!parsed) continue;
            const shape = collectiveRelationshipShape(parsed);
            if (shape) {
                pushFact(npc, shape.expectedCount, parsed.relation, shape.sharedDescriptor, [], raw);
            }
        }
    }
    return facts;
}
