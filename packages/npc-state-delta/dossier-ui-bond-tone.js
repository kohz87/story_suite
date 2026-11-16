/* NPC State Delta dossier bond tone: maps a relation text to a display tone (close, hostile, duty, neutral)
   for the dossier's bond lines and the map. Pure: no DOM, no storage. Family detection comes
   from social-relations.js; the enemy and duty words are matched here because that file has no such family. */
import { norm } from './social-primitives.js';
import { socialRelationFamily } from './social-relations.js';

const HOSTILE_WORD = /\b(?:enem|foe|nemesis|hate)\w*/;
const DUTY_WORD = /\b(?:owes?|owed|debts?|duty|duties|oath|sworn|indebted)\b/;
const CLOSE_FAMILIES = new Set([
    'child', 'parent', 'sibling', 'partner', 'mentor', 'student', 'guardian', 'ward', 'friend',
    'cousin', 'aunt-uncle', 'niece-nephew', 'grandparent', 'grandchild',
    'parent-in-law', 'child-in-law', 'sibling-in-law',
]);

// Tone precedence: hostile first (a "former friend turned enemy" is hostile), then duty, then close kin or
// friend-like families, else neutral. Empty or unknown text is neutral.
export function bondTone(relationText) {
    const rel = norm(relationText);
    if (!rel) return 'neutral';
    if (HOSTILE_WORD.test(rel) || socialRelationFamily(rel) === 'rival') return 'hostile';
    if (DUTY_WORD.test(rel)) return 'duty';
    if (CLOSE_FAMILIES.has(socialRelationFamily(rel))) return 'close';
    return 'neutral';
}

// A bond's tone from its tie tags: rival or enemy is hostile, then owes or serves is duty, then kin, partner, friend, ally or mentor is close; none: null.
const HOSTILE_TAGS = ['rival', 'enemy'];
const DUTY_TAGS = ['owes', 'serves'];
const CLOSE_TAGS = ['kin', 'partner', 'friend', 'ally', 'mentor'];
export function tieTone(tags) {
    const list = Array.isArray(tags) ? tags : [];
    if (HOSTILE_TAGS.some(tag => list.includes(tag))) return 'hostile';
    if (DUTY_TAGS.some(tag => list.includes(tag))) return 'duty';
    return CLOSE_TAGS.some(tag => list.includes(tag)) ? 'close' : null;
}
