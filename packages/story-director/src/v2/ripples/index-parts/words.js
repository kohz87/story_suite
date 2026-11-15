// Whole-word name matching for the ripples scoring.

import { fold } from './shared-text.js';

const WORDS = new Map();
/** The whole-word test of one folded needle (cached: a table has few names). */
function wordTest(want) {
    if (!WORDS.has(want)) {
        if (WORDS.size > 500) WORDS.clear();
        WORDS.set(want, new RegExp(`(?<![\\p{L}\\p{N}])${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u'));
    }
    return WORDS.get(want);
}

/** True when `haystack` (folded once by the caller, or here) holds one of the non-empty `needles` as a whole word. */
export function mentions(haystack, needles) {
    const hay = fold(haystack);
    return needles.some(needle => {
        const want = fold(needle);
        return want !== '' && wordTest(want).test(hay);
    });
}

/** A power's labels: its name and aliases (folded text is matched, so the case is kept for display only). */
export const labelsOf = power => [power.name, ...power.aliases];
