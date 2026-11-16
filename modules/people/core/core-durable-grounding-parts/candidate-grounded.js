/* NPC State Delta refinement candidate grounding: whether a proposed durable field text is supported by the source. */

import { normalizeName } from '../core-text.js';
import { compactDurableText, DURABLE_PROFILE_LIMITS, durableRefinementTokens, durableSemanticSimilarity, splitDurableClaimUnits } from '../core-relationship.js';
import { identityMoralityConflict } from '../core-durable-identity.js';
import { durableRefinementSupportText } from './support-text.js';
import { affirmativeOwnClaimText } from './speech-claims.js';

export function durableRefinementCandidateGrounded(field, existing, incoming, context = '', evidenceItems = [], binding = null) {
    const maxChars = DURABLE_PROFILE_LIMITS[field] || DURABLE_PROFILE_LIMITS.appearance;
    const oldText = compactDurableText(existing, maxChars, field === 'speech' ? 5 : (field === 'personality' ? 6 : 10));
    const newText = compactDurableText(incoming, maxChars, field === 'speech' ? 5 : (field === 'personality' ? 6 : 10));
    if (!newText) return false;
    const rawSupport = durableRefinementSupportText(context, evidenceItems, binding);
    const support = field === 'speech' && rawSupport ? affirmativeOwnClaimText(rawSupport, binding) : rawSupport;
    // Only a caller with no narration at all (structured import/API) skips grounding. Narration
    // that contains nothing about this NPC, and no evidence attributed to it, supports nothing.
    const narrationSupplied = Boolean(String(context || '').trim());
    if (!oldText) {
        if (!support) return !narrationSupplied;
        const clauses = splitDurableClaimUnits(newText);
        const supportTokens = new Set(durableRefinementTokens(support));
        return clauses.length > 0 && clauses.every(clause => {
            const tokens = [...new Set(durableRefinementTokens(clause))]
                .filter(token => token.length >= 3 && !/^\d+$/.test(token));
            if (!tokens.length) return false;
            const supported = tokens.filter(token => supportTokens.has(token)).length;
            const required = tokens.length <= 2 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.55));
            return supported >= required;
        });
    }
    if (normalizeName(oldText) === normalizeName(newText)) return true;
    if (field === 'personality' && identityMoralityConflict(oldText, newText)) return false;

    // Structured import/API compatibility: callers without source narration retain the
    // established direct-refinement behavior. Runtime scanner paths always supply context.
    if (!support) return !narrationSupplied;

    const oldTokens = new Set(durableRefinementTokens(oldText));
    const supportTokens = new Set(durableRefinementTokens(support));

    // Identify novel clauses that introduce meaning absent from the accepted current summary.
    const oldClauses = splitDurableClaimUnits(oldText);
    const newClauses = splitDurableClaimUnits(newText);
    const novelClauses = newClauses.filter(clause => !oldClauses.some(oldClause =>
        normalizeName(oldClause) === normalizeName(clause)
        || durableSemanticSimilarity(oldClause, clause) >= 0.72));

    if (!novelClauses.length) {
        return durableSemanticSimilarity(oldText, newText) >= 0.72;
    }

    // Every substantive newly introduced clause must be independently grounded in support.
    // A supported clause cannot authorize unrelated additions.
    return novelClauses.every(clause => {
        const clauseTokens = [...new Set(durableRefinementTokens(clause))]
            .filter(token => !oldTokens.has(token) && token.length >= 3 && !/^\d+$/.test(token));
        if (!clauseTokens.length) return true;
        const clauseSupported = clauseTokens.filter(token => supportTokens.has(token)).length;
        const required = clauseTokens.length <= 2 ? 1 : Math.max(2, Math.ceil(clauseTokens.length * 0.55));
        return clauseSupported >= required;
    });
}
