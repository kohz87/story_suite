/* NPC State Delta profile evidence: whether two claims state opposite polarity (negation or morality conflict). */
import { durableRefinementTokens, durableSemanticSimilarity, splitDurableClaimUnits } from '../core-relationship.js';
import { normalizeName } from '../core-text.js';
import { moralityPolarity } from '../core-behavior.js';
import { identityMoralityConflict } from '../core-durable.js';

export function durableClaimHasNegation(value) {
    const text = normalizeName(value);
    return /\b(?:not|never|no longer|without|lacks?|lacking|ceased|stopped|avoids?|rejects?|unable|cannot|cant)\b/.test(text);
}

function durableClaimWithoutNegation(value) {
    return normalizeName(value)
        .replace(/\b(?:not|never|no longer|without|lacks?|lacking|ceased|stopped|avoids?|rejects?|unable|cannot|cant)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function singleClausePolarityConflict(claim, targetClause) {
    if (identityMoralityConflict(claim, targetClause) || identityMoralityConflict(targetClause, claim)) return true;
    const claimCore = durableClaimWithoutNegation(claim);
    const targetCore = durableClaimWithoutNegation(targetClause);
    if (!claimCore || !targetCore) return false;
    const coreSimilarity = durableSemanticSimilarity(claimCore, targetCore);
    const coreTokensClaim = new Set(durableRefinementTokens(claimCore));
    const coreTokensTarget = new Set(durableRefinementTokens(targetCore));
    let overlap = 0;
    for (const t of coreTokensClaim) if (coreTokensTarget.has(t)) overlap += 1;
    const relevant = coreSimilarity >= 0.48 || (overlap >= 2 && overlap / Math.min(coreTokensClaim.size, coreTokensTarget.size) >= 0.6);
    if (!relevant) return false;

    const claimNegated = durableClaimHasNegation(claim);
    const targetNegated = durableClaimHasNegation(targetClause);
    if (claimNegated !== targetNegated) return true;
    if (claimNegated && targetNegated) {
        const claimPol = moralityPolarity(claim);
        const targetPol = moralityPolarity(targetClause);
        if (claimPol && targetPol && claimPol !== targetPol) return true;
        if (identityMoralityConflict(claim, targetClause)) return true;
    }
    return false;
}

export function durableClaimPolarityConflict(claim, target) {
    const claimClauses = splitDurableClaimUnits(claim);
    const targetClauses = splitDurableClaimUnits(target);
    for (const cClause of claimClauses) {
        for (const tClause of targetClauses) {
            if (singleClausePolarityConflict(cClause, tClause)) return true;
        }
    }
    return false;
}
