/* NPC State Delta mannerism matching: pattern families, similarity scoring and de-duplicating normalization. */

import { cleanList, normalizeName } from '../core-text.js';
import { chooseCompactEquivalent, DURABLE_PROFILE_LIMITS, durableSemanticSimilarity } from '../core-relationship.js';

function mannerismPatternFamily(value) {
    const text = normalizeName(value);
    if (!text) return '';
    const paperwork = /\b(?:paperwork|paper|parchment|contract|notice|notices|document|documents|quill|quills|stamp|stamps|seal|seals|inkpad)\b/.test(text);
    const emphaticHandling = /\b(?:thrust|thrusts|slap|slaps|flick|flicks|shove|shoves|push|pushes|hand|hands|gesture|gestures|brisk|briskly|snap|snaps)\b/.test(text);
    if (paperwork && emphaticHandling) return 'paperwork_handling';
    return '';
}

function generalizedMannerismForFamily(family) {
    if (family === 'paperwork_handling') return 'Handles paperwork with brisk, emphatic physical gestures.';
    return '';
}

export function mannerismSimilarity(a, b) {
    const familyA = mannerismPatternFamily(a);
    const familyB = mannerismPatternFamily(b);
    if (familyA && familyA === familyB) return 0.95;
    return durableSemanticSimilarity(a, b);
}

export function normalizeMannerisms(value) {
    const items = cleanList(value, 16, DURABLE_PROFILE_LIMITS.mannerism);
    const out = [];
    const familyCounts = new Map();
    for (const item of items) {
        const family = mannerismPatternFamily(item);
        if (family) familyCounts.set(family, Number(familyCounts.get(family) || 0) + 1);
        let bestIndex = -1;
        let bestScore = 0;
        for (let i = 0; i < out.length; i += 1) {
            const score = mannerismSimilarity(out[i], item);
            if (score > bestScore) { bestScore = score; bestIndex = i; }
        }
        if (bestIndex >= 0 && bestScore >= 0.55) {
            const existingFamily = mannerismPatternFamily(out[bestIndex]);
            if (family && existingFamily === family && Number(familyCounts.get(family) || 0) >= 2) {
                out[bestIndex] = generalizedMannerismForFamily(family) || chooseCompactEquivalent(out[bestIndex], item);
            } else {
                out[bestIndex] = chooseCompactEquivalent(out[bestIndex], item);
            }
        } else if (out.length < 4) {
            out.push(item);
        }
    }
    return out.slice(0, 4);
}
