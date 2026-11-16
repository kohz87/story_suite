/* NPC State Delta unmarked durable refinement safety: token-overlap admission, replacement and merge of refined text. */

import { normalizeName } from '../core-text.js';
import { compactDurableText, DURABLE_PROFILE_LIMITS, durableRefinementTokens, durableSemanticSimilarity, durableTokenCoverage } from '../core-relationship.js';
import { containsEvolutionLanguage } from '../core-durable-identity.js';

export function isSafeUnmarkedDurableRefinement(existing, incoming) {
    const oldText = compactDurableText(existing, DURABLE_PROFILE_LIMITS.appearance, 10);
    const newText = compactDurableText(incoming, DURABLE_PROFILE_LIMITS.appearance, 10);
    if (!oldText || !newText || normalizeName(oldText) === normalizeName(newText)) return false;
    const oldTokens = new Set(durableRefinementTokens(oldText));
    const newTokens = new Set(durableRefinementTokens(newText));
    const addsGroundedDetail = [...newTokens].some(token => !oldTokens.has(token));
    return addsGroundedDetail && (durableTokenCoverage(oldText, newText) >= 0.62 || durableSemanticSimilarity(oldText, newText) >= 0.58);
}

export function isSafeUnmarkedDurableReplacement(existing, incoming) {
    if (containsEvolutionLanguage(incoming) || !isSafeUnmarkedDurableRefinement(existing, incoming)) return false;
    const oldText = compactDurableText(existing, DURABLE_PROFILE_LIMITS.appearance, 10);
    const newText = compactDurableText(incoming, DURABLE_PROFILE_LIMITS.appearance, 10);
    // Missing/keep state has no omission-as-deletion authority. It may adopt an enrichment
    // only when every established durable concept remains represented in the incoming summary.
    // Explicit evolution language such as "no longer" is rejected above so lexical retention
    // inside a negation cannot masquerade as preservation of the established meaning.
    return durableTokenCoverage(oldText, newText) >= 1;
}

export function mergeDurableTextRefinement(existing, incoming, maxChars) {
    const clauseCap = maxChars <= DURABLE_PROFILE_LIMITS.speech ? 5
        : (maxChars <= DURABLE_PROFILE_LIMITS.personality ? 6 : 10);
    const oldText = compactDurableText(existing, maxChars, clauseCap);
    const newText = compactDurableText(incoming, maxChars, clauseCap);
    if (!oldText) return newText;
    if (!newText || normalizeName(oldText) === normalizeName(newText)) return oldText;

    // `refine` is a full CURRENT summary contract. Safety/admission is decided by the caller;
    // once accepted, omitted old clauses are intentionally retired instead of appended back.
    // Historical evidence belongs in profileEvidence, not inside the current dossier field.
    return newText;
}
