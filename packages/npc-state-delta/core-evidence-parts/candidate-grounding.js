/* NPC State Delta profile evidence: whether a proposed personality or speech refinement is grounded in, and supported by, the evidence. */
import { compactDurableText, DURABLE_PROFILE_LIMITS, durableRefinementTokens, durableSeedGrounded, durableSemanticSimilarity, splitDurableClaimUnits } from '../core-relationship.js';
import { cleanText, normalizeName } from '../core-text.js';
import { durableProfileCollectionCandidateGrounded, strippedDevelopmentEvidence } from '../core-behavior.js';
import { containsEvolutionLanguage, identityMoralityConflict } from '../core-durable.js';
import { durableClaimPolarityConflict } from './claim-polarity.js';
import { durableDevelopmentClaimRepresented } from './represented.js';

export function durableProfileEvolutionCandidateGrounded(field, existing, incoming, evidenceItems = []) {
    const key = field === 'personality' ? 'personality' : field === 'speech' ? 'speech' : '';
    if (!key) return false;
    const maxChars = DURABLE_PROFILE_LIMITS[key];
    const oldText = compactDurableText(existing, maxChars, key === 'speech' ? 5 : 6);
    const newText = compactDurableText(incoming, maxChars, key === 'speech' ? 5 : 6);
    if (!oldText || !newText || normalizeName(oldText) === normalizeName(newText)) return false;
    if (containsEvolutionLanguage(newText)) return false;
    if (key === 'personality' && identityMoralityConflict(oldText, newText)) return false;
    const oldTokens = new Set(durableRefinementTokens(oldText));
    const changedTokens = [...new Set(durableRefinementTokens(newText))].filter(token => !oldTokens.has(token));
    if (!changedTokens.length) return false;
    const evidenceTokens = new Set(durableRefinementTokens((Array.isArray(evidenceItems) ? evidenceItems : []).join(' ')));
    const supported = changedTokens.filter(token => evidenceTokens.has(token)).length;
    const required = changedTokens.length <= 2 ? 1 : Math.max(2, Math.ceil(changedTokens.length * 0.4));
    return supported >= required;
}

// Gradual candidate support deliberately does not merge concept buckets. The proposed full
// candidate is the semantic bridge: independent evidence groups must each support newly proposed
// characterization, while their union must ground enough of the changed candidate to pass the
// ordinary candidate-grounding threshold. Field/change class decides whether two or three are needed.
function durableProfileClaimsEquivalent(left, right) {
    if (!left || !right || durableClaimPolarityConflict(left, right)) return false;
    return durableDevelopmentClaimRepresented(left, right)
        || durableDevelopmentClaimRepresented(right, left)
        || durableSemanticSimilarity(left, right) >= 0.42;
}

function durableEvidenceSupportsProfileClaim(claim, evidence) {
    const sample = strippedDevelopmentEvidence(evidence);
    if (!claim || !sample || durableClaimPolarityConflict(claim, sample)) return false;
    return durableDevelopmentClaimRepresented(claim, sample)
        || durableSeedGrounded(claim, sample)
        || durableSemanticSimilarity(claim, sample) >= 0.28;
}

export function durableProfileCandidateSupport(field, existing, incoming, evidenceGroups = [], requiredObservations = null) {
    const key = field === 'personality' ? 'personality' : field === 'speech' ? 'speech' : '';
    const empty = {
        ready: false,
        grounded: false,
        changeClass: 'none',
        requiredObservations: Math.max(1, Number(requiredObservations) || 3),
        supportingGroups: 0,
        introducedClaims: [],
        retiredClaims: [],
        supportCounts: [],
    };
    if (!key) return empty;

    const maxChars = DURABLE_PROFILE_LIMITS[key];
    const oldText = compactDurableText(existing, maxChars, key === 'speech' ? 5 : 6);
    const newText = compactDurableText(incoming, maxChars, key === 'speech' ? 5 : 6);
    if (!oldText || !newText || normalizeName(oldText) === normalizeName(newText)) return empty;
    if (containsEvolutionLanguage(newText)) return empty;
    if (key === 'personality' && identityMoralityConflict(oldText, newText)) return empty;

    const oldClaims = splitDurableClaimUnits(oldText);
    const newClaims = splitDurableClaimUnits(newText);
    const introducedClaims = newClaims.filter(claim =>
        !oldClaims.some(previous => durableProfileClaimsEquivalent(previous, claim)));
    const retiredClaims = oldClaims.filter(claim =>
        !newClaims.some(next => durableProfileClaimsEquivalent(claim, next)));
    const polarityReversal = oldClaims.some(previous =>
        newClaims.some(next => durableClaimPolarityConflict(previous, next)));
    const changeClass = retiredClaims.length || polarityReversal ? 'reversal' : 'additive';
    const required = Math.max(1, Number(requiredObservations)
        || (key === 'speech' && changeClass === 'additive' ? 2 : 3));
    const groups = (Array.isArray(evidenceGroups) ? evidenceGroups : [])
        .map(strippedDevelopmentEvidence)
        .filter(Boolean);
    if (!introducedClaims.length || !groups.length) {
        return { ...empty, changeClass, requiredObservations: required, introducedClaims, retiredClaims };
    }

    const supportCounts = introducedClaims.map(claim =>
        groups.filter(group => durableEvidenceSupportsProfileClaim(claim, group)).length);
    const supportingGroups = groups.filter(group =>
        introducedClaims.some(claim => durableEvidenceSupportsProfileClaim(claim, group))).length;
    const grounded = supportCounts.every(count => count >= 1)
        && durableProfileEvolutionCandidateGrounded(key, oldText, newText, groups);
    return {
        ready: grounded && supportCounts.every(count => count >= required),
        grounded,
        changeClass,
        requiredObservations: required,
        supportingGroups,
        introducedClaims,
        retiredClaims,
        supportCounts,
    };
}

export function durableProfileAggregateCandidateGrounded(field, existing, incoming, evidenceGroups = [], requiredGroups = 3) {
    const required = Math.max(2, Number(requiredGroups) || 3);
    const key = field === 'personality' ? 'personality' : field === 'speech' ? 'speech' : '';
    if (!key) return false;
    const maxChars = DURABLE_PROFILE_LIMITS[key];
    const oldText = compactDurableText(existing, maxChars, key === 'speech' ? 5 : 6);
    const newText = compactDurableText(incoming, maxChars, key === 'speech' ? 5 : 6);
    if (!oldText || !newText || normalizeName(oldText) === normalizeName(newText)) return false;
    if (containsEvolutionLanguage(newText)) return false;
    if (key === 'personality' && identityMoralityConflict(oldText, newText)) return false;

    const oldTokens = new Set(durableRefinementTokens(oldText));
    const changedTokens = [...new Set(durableRefinementTokens(newText))].filter(token => !oldTokens.has(token));
    if (!changedTokens.length) return false;
    const groups = (Array.isArray(evidenceGroups) ? evidenceGroups : [])
        .map(value => cleanText(value, DURABLE_PROFILE_LIMITS.evidence))
        .filter(Boolean);
    if (groups.length < required) return false;

    const changedSet = new Set(changedTokens);
    const supportingGroups = groups.filter(value => durableRefinementTokens(value).some(token => changedSet.has(token))).length;
    if (supportingGroups < required) return false;
    return durableProfileEvolutionCandidateGrounded(key, oldText, newText, groups);
}

export function durableProfileEvidenceReason(field, existing, incoming, evidenceItems = []) {
    const evidence = (Array.isArray(evidenceItems) ? evidenceItems : [])
        .map(strippedDevelopmentEvidence).filter(Boolean);
    if (!evidence.length) return '';
    const grounded = field === 'personality' || field === 'speech'
        ? durableProfileEvolutionCandidateGrounded(field, existing, incoming, evidence)
        : durableProfileCollectionCandidateGrounded(field, existing, incoming, evidence);
    return grounded ? cleanText(evidence.join(' '), 500) : '';
}
