/* NPC State Delta explicit edges: extracting stated relationships ("X is Y's sister") from a transcript as key-relationship edges. */
import { cleanText, normalizeName } from '../core-text.js';
import { relationshipEdgeNpc } from './edges.js';

function escapeRegexLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EXPLICIT_SOCIAL_RELATION = String.raw`(?:older\s+|younger\s+|elder\s+|adoptive\s+|biological\s+|step[- ]?|half[- ]?|former\s+|ex[- ]?|best\s+|close\s+|childhood\s+)?(?:sister|brother|sibling|mother|father|parent|daughter|son|child|wife|husband|spouse|fianc(?:e|ee|é|ée)|girlfriend|boyfriend|partner|lover|friend|rival|mentor|student|apprentice|prot(?:e|é)g(?:e|é)|teacher|guardian|ward|cousin|aunt|uncle|niece|nephew|grandmother|grandfather|grandparent)`;
const SYMMETRIC_SOCIAL_RELATIONS = new Set(['friend', 'best friend', 'close friend', 'childhood friend', 'rival', 'cousin', 'partner', 'lover', 'spouse', 'sibling', 'sister', 'brother']);

function inverseExplicitSocialRelation(relation) {
    const rel = cleanText(relation, 180).toLowerCase().replace(/\s+/g, ' ');
    if (!rel) return '';
    if (SYMMETRIC_SOCIAL_RELATIONS.has(rel)) return rel;
    if (/^(?:older|elder)\s+(?:sister|brother|sibling)$/.test(rel)) return 'younger sibling';
    if (/^younger\s+(?:sister|brother|sibling)$/.test(rel)) return 'older sibling';
    if (/^(?:mother|father|parent)$/.test(rel)) return 'child';
    if (/^(?:daughter|son|child)$/.test(rel)) return 'parent';
    if (/^(?:wife|husband|spouse)$/.test(rel)) return 'spouse';
    if (/^(?:girlfriend|boyfriend|partner|lover|fianc(?:e|ee|é|ée))$/.test(rel)) return 'partner';
    if (/^(?:mentor|teacher)$/.test(rel)) return 'student';
    if (/^(?:student|apprentice|prot(?:e|é)g(?:e|é))$/.test(rel)) return 'mentor';
    if (rel === 'guardian') return 'ward';
    if (rel === 'ward') return 'guardian';
    if (/^(?:aunt|uncle)$/.test(rel)) return 'niece/nephew';
    if (/^(?:niece|nephew)$/.test(rel)) return 'aunt/uncle';
    if (/^(?:grandmother|grandfather|grandparent)$/.test(rel)) return 'grandchild';
    return '';
}

export function extractExplicitKeyRelationshipEdges(transcript, existingNpcs = [], excludeNames = []) {
    // A run of 400+ characters with no space is not prose (a pasted blob, an encoded image): the name patterns below restart at
    // every capital in it, which costs the square of its length, and no relationship statement can be in it. It reads as a space.
    const text = String(transcript || '').replace(/[\r\n]+/g, ' ').replace(/\S{400,}/gu, ' ');
    if (!text.trim()) return [];
    const excluded = new Set((excludeNames || []).map(normalizeName).filter(Boolean));
    const proper = String.raw`([\p{Lu}][\p{L}\p{M}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’.-]*){0,2})`;
    const out = [];
    const seen = new Set();
    const push = (owner, counterpart, relation) => {
        const ownerNpc = relationshipEdgeNpc(existingNpcs, owner?.id, owner?.name);
        const ownerName = cleanText(ownerNpc?.name || owner?.name, 120);
        const other = cleanText(counterpart, 120).replace(/^["'“”‘’]+|["'“”‘’.,;:!?]+$/g, '');
        const rel = cleanText(relation, 180).toLowerCase();
        if (!ownerNpc || !ownerName || !other || !rel) return;
        if (normalizeName(other) === normalizeName(ownerName) || excluded.has(normalizeName(other))) return;
        const otherNpc = relationshipEdgeNpc(existingNpcs, '', other);
        const canonicalOther = cleanText(otherNpc?.name || other, 120);
        const inverse = inverseExplicitSocialRelation(rel);
        const key = `${ownerNpc.id}|${normalizeName(canonicalOther)}|${normalizeName(rel)}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            aId: ownerNpc.id,
            a: ownerName,
            bId: otherNpc?.id || '',
            b: canonicalOther,
            aToB: rel,
            bToA: otherNpc ? inverse : '',
            reason: 'explicit relationship statement in current exchange',
        });
    };
    for (const npc of Array.isArray(existingNpcs) ? existingNpcs : []) {
        const labels = [npc?.name, ...(npc?.aliases || [])].map(value => cleanText(value, 120)).filter(Boolean).slice(0, 6);
        for (const label of labels) {
            const owner = escapeRegexLiteral(label);
            const possessive = `${owner}(?:['’]s|['’])`;
            const patterns = [
                new RegExp(`${proper}\\s+(?:is|was|remains)\\s+${possessive}\\s+(${EXPLICIT_SOCIAL_RELATION})\\b`, 'giu'),
                new RegExp(`${proper}\\s*,\\s*${possessive}\\s+(${EXPLICIT_SOCIAL_RELATION})\\b`, 'giu'),
                new RegExp(`${possessive}\\s+(${EXPLICIT_SOCIAL_RELATION})\\s+(?:is|was|remains)\\s+${proper}`, 'giu'),
            ];
            for (let pi = 0; pi < patterns.length; pi += 1) {
                for (const match of text.matchAll(patterns[pi])) {
                    if (pi < 2) push(npc, match[1], match[2]);
                    else push(npc, match[2], match[1]);
                }
            }
            const symmetric = new RegExp(`${owner}\\s+and\\s+${proper}\\s+(?:are|were|remain)\\s+((?:best\\s+|close\\s+|childhood\\s+)?friends?|rivals?|siblings?|sisters?|brothers?|partners?|lovers?|cousins?)\\b`, 'giu');
            for (const match of text.matchAll(symmetric)) {
                let rel = cleanText(match[2], 120).toLowerCase();
                rel = rel.replace(/friends$/, 'friend').replace(/rivals$/, 'rival').replace(/siblings$/, 'sibling').replace(/sisters$/, 'sister').replace(/brothers$/, 'brother').replace(/partners$/, 'partner').replace(/lovers$/, 'lover').replace(/cousins$/, 'cousin');
                push(npc, match[1], rel);
            }
        }
    }
    return out.slice(0, 12);
}
