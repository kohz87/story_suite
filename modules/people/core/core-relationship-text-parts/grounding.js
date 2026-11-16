/* Token coverage and grounding tests for durable text against context and evidence. */
import { durableRefinementTokens } from './tokens.js';

export function durableTokenCoverage(existing, incoming) {
    const oldTokens = [...new Set(durableRefinementTokens(existing))];
    if (!oldTokens.length) return 0;
    const newTokens = new Set(durableRefinementTokens(incoming));
    return oldTokens.filter(token => newTokens.has(token)).length / oldTokens.length;
}

export function durableSeedGrounded(value, context = '') {
    const source = String(context || '').trim();
    if (!source) return true; // structured import/API compatibility when no source narration is available.
    const proposed = [...new Set(durableRefinementTokens(value))]
        .filter(token => token.length >= 3 && !/^\d+$/.test(token));
    if (!proposed.length) return false;
    const sourceTokens = new Set(durableRefinementTokens(source));
    const overlap = proposed.filter(token => sourceTokens.has(token));
    // One distinctive directly stated concept is enough for a tiny field; larger summaries
    // need at least two grounded concepts so one observed act cannot mint a whole personality.
    const required = proposed.length <= 2 ? 1 : 2;
    return overlap.length >= required;
}

export function durableEvidenceGroundsValue(value, evidenceItems = []) {
    const proposed = [...new Set(durableRefinementTokens(value))]
        .filter(token => token.length >= 3 && !/^\d+$/.test(token));
    if (!proposed.length) return false;
    const evidenceTokens = new Set(durableRefinementTokens((Array.isArray(evidenceItems) ? evidenceItems : []).join(' ')));
    const overlap = proposed.filter(token => evidenceTokens.has(token)).length;
    const required = proposed.length <= 2 ? proposed.length : Math.ceil(proposed.length * 0.6);
    return overlap >= required;
}
