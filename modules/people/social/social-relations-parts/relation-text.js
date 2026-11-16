/* Judging whether a subject or entry reads as a structured bond, and splitting kinship parts.
   Part of social-relations.js; social-relations.js re-exports it. */

import { clean, norm } from '../social-primitives.js';

function relationshipSubjectLooksStructured(value) {
    const subject = clean(value, 120);
    if (!subject || /[.!?]\s*$/.test(subject)) return false;
    const words = norm(subject).split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 8) return false;
    return !/^(?:supports?|provides?|raises?|feeds?|dresses?|guides?|works?|serves?|helps?|keeps?|uses?|lives?|died|dies|has|had|is|was|were|remains?|cares?)\b/i.test(subject);
}

// A bare life-state word is a fragment split off a bond ("…; deceased"), never a bond itself.
const ORPHAN_LIFE_STATE = /^\(?(?:deceased|dead|late|departed)\)?\.?$/i;

function preserveUnstructuredRelationshipText(value) {
    const text = clean(value, 420);
    if (!text || /[.!?]\s*$/.test(text) || ORPHAN_LIFE_STATE.test(text)) return false;
    if (/^(?:supports?|provides?|raises?|feeds?|dresses?|guides?|works?|serves?|helps?|keeps?|uses?|lives?|died|dies|has|had|is|was|were|remains?|cares?)\b/i.test(text)) return false;
    const words = norm(text).split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 8;
}

function kinshipParts(value) {
    return clean(value, 180).split(/\s*\/\s*/).map(part => clean(part, 180)).filter(Boolean);
}

export { relationshipSubjectLooksStructured, ORPHAN_LIFE_STATE, preserveUnstructuredRelationshipText, kinshipParts };
