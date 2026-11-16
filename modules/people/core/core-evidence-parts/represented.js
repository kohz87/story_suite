/* NPC State Delta profile evidence: whether evidence claims are already represented in the accepted profile text. */
import { DURABLE_PROFILE_LIMITS, durableRefinementTokens, splitDurableClaimUnits } from '../core-relationship.js';
import { cleanText } from '../core-text.js';
import { behaviorProfileBody, normalizeBehaviorProfile } from '../core-behavior.js';
import { normalizeMannerisms } from '../core-durable.js';
import { durableClaimPolarityConflict, singleClausePolarityConflict } from './claim-polarity.js';

function developmentEvidenceClaim(value) {
    let text = cleanText(String(value || '').replace(/^\[m\d+\]\s*/i, ''), DURABLE_PROFILE_LIMITS.evidence);
    if (!text) return null;
    const labeled = text.match(/^([^:]{1,52}):\s*(.+)$/);
    const concept = cleanText(labeled?.[1], 80);
    const body = cleanText(labeled ? labeled[2] : text, DURABLE_PROFILE_LIMITS.evidence);
    return body ? { concept, body } : null;
}

export function durableDevelopmentClaimRepresented(claim, target) {
    const source = cleanText(claim, DURABLE_PROFILE_LIMITS.evidence);
    const accepted = cleanText(target, DURABLE_PROFILE_LIMITS.behaviorProfile * 6);
    if (!source || !accepted) return false;
    if (durableClaimPolarityConflict(source, accepted)) return false;

    const claimClauses = splitDurableClaimUnits(source);
    const acceptedClauses = splitDurableClaimUnits(accepted);
    const acceptedTokens = new Set(durableRefinementTokens(accepted));

    return claimClauses.every(cClause => {
        const cText = cleanText(cClause, DURABLE_PROFILE_LIMITS.evidence);
        const cTokens = [...new Set(durableRefinementTokens(cText))].filter(t => t.length >= 3 && !/^\d+$/.test(t));
        if (!cTokens.length) return true;
        if (acceptedClauses.some(tClause => singleClausePolarityConflict(cClause, tClause))) return false;

        const overlap = cTokens.filter(t => acceptedTokens.has(t)).length;
        const required = cTokens.length <= 2
            ? cTokens.length
            : (cTokens.length === 3 ? 2 : Math.max(2, Math.ceil(cTokens.length * 0.5)));
        return overlap >= required;
    });
}

export function durableProfileEvidenceAlreadyRepresented(field, current, evidenceItems = []) {
    const claims = (Array.isArray(evidenceItems) ? evidenceItems : [])
        .map(developmentEvidenceClaim).filter(Boolean);
    if (!claims.length) return false;
    let targets = [];
    if (field === 'personality' || field === 'speech') {
        const currentText = cleanText(current, DURABLE_PROFILE_LIMITS[field]);
        if (currentText) targets = [currentText];
    } else if (field === 'mannerisms') {
        targets = normalizeMannerisms(current);
    } else if (field === 'behaviorProfile') {
        targets = normalizeBehaviorProfile(current);
    } else {
        return false;
    }
    if (!targets.length) return false;
    return claims.every(claim => targets.some(target =>
        durableDevelopmentClaimRepresented(claim.body, target)
        || (field === 'behaviorProfile' && durableDevelopmentClaimRepresented(claim.body, behaviorProfileBody(target)))));
}
