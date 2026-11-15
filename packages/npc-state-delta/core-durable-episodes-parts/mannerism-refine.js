/* NPC State Delta mannerism refinement admission: explicit-recurrence checks and safe-refinement filtering. */

import { cleanText, normalizeName } from '../core-text.js';
import { DURABLE_PROFILE_LIMITS, durableRefinementTokens } from '../core-relationship.js';
import { mannerismSimilarity, normalizeMannerisms } from './mannerism-match.js';

function hasRecurrenceMarker(value) {
    const text = normalizeName(value);
    return /\b(habitual|habitually|always|usually|consistently|routinely|regularly|repeatedly|whenever)\b/.test(text)
        || /\btends to\b/.test(text)
        || /\beach time\b/.test(text)
        || /\bevery time\b/.test(text);
}

export function isExplicitRecurringMannerism(value, context = '') {
    const entry = cleanText(value, DURABLE_PROFILE_LIMITS.mannerism);
    const source = String(context || '').trim();
    if (!source) return hasRecurrenceMarker(entry);
    if (!hasRecurrenceMarker(source)) return false;
    const entryTokens = [...new Set(durableRefinementTokens(entry))];
    const sourceTokens = new Set(durableRefinementTokens(source));
    const overlap = entryTokens.filter(token => sourceTokens.has(token));
    return overlap.length >= Math.min(2, Math.max(1, entryTokens.length));
}

export function filterSafeMannerismRefinements(existing, incoming, allowNewPattern = false, context = '') {
    const current = normalizeMannerisms(existing);
    return normalizeMannerisms(incoming).filter(entry => {
        const related = current.some(item => mannerismSimilarity(item, entry) >= 0.55);
        return related || allowNewPattern || isExplicitRecurringMannerism(entry, context);
    });
}
