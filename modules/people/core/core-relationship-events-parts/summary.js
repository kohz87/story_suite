/* NPC State Delta relationship summary: checks a relationship summary for unsupported claims and calibrates its wording to the meters. */
import { DEFAULT_RELATIONSHIP, DURABLE_PROFILE_LIMITS, normalizeRelationshipBaseline, normalizeRelationshipMilestones, relationshipMilestoneUnlocked } from '../core-relationship-model.js';
import { compactDurableText, durableSeedGrounded, durableSemanticSimilarity } from '../core-relationship-text.js';

function relationshipSummaryHasUnsupportedClaims(value, relationship = DEFAULT_RELATIONSHIP, milestones = null) {
    const text = String(value || '').trim();
    if (!text) return false;
    const rel = normalizeRelationshipBaseline(relationship || DEFAULT_RELATIONSHIP);
    const positiveStrength = Math.max(0, rel.trust, rel.affection, rel.desire);
    const milestoneState = normalizeRelationshipMilestones(
        milestones,
        rel,
        { inferFromRelationship: milestones == null },
    );
    const unlocked = (axis, polarity, threshold) => relationshipMilestoneUnlocked(milestoneState, axis, polarity, threshold);
    const desireClaims = /\b(madly in love|in love|romantic|romance|sexually|sexual attraction|lust|desire[sd]?|intimate attraction|physically attracted|yearns? for|wants? (?:him|her|them|the player) physically)\b/i;
    const tropeClaims = /\b(possessive|jealous|obsessive|obsessed|would kill|kill anyone|belongs to (?:him|her|them|the player)|cannot bear (?:him|her|them|the player) with|unconditionally devoted|utterly devoted)\b/i;
    const absoluteClaims = /\b(indispensable|everything to (?:her|him|them)|cannot live without|can't live without|completely dependent|utterly dependent)\b/i;
    const deepTrustClaims = /\b(deep(?:est)? trust|deeply trusts?|profound trust|unwavering trust|unquestion(?:ing|ed) trust|complete trust|implicit trust|central to (?:her|his|their) (?:deepest )?trust)\b/i;
    const exceptionalTrustClaims = /\b(absolute trust|unbreakable trust|trusts? (?:him|her|them|the player) with (?:her|his|their) life|trusts? (?:him|her|them|the player) without reservation)\b/i;
    const deepAffectionClaims = /\b(deep affection|deeply attached|profound attachment|central to (?:her|his|their) life|one of (?:her|his|their) most important people)\b/i;
    const exceptionalAffectionClaims = /\b(inseparable|irreplaceable|life-defining bond|devoted to (?:him|her|them|the player))\b/i;
    const deepDistrustClaims = /\b(deep distrust|profound distrust|deeply distrusts?|cannot trust (?:him|her|them|the player) at all)\b/i;
    const deepDislikeClaims = /\b(deep hatred|profound hatred|deep resentment|utterly hates?)\b/i;
    // Obligation, fixation and role claims make the player uniquely important ("her chosen partner,
    // protector and provider", "must repay him", "only he can") and need established depth too.
    const obligationClaims = /\b(chosen (?:partner|one|mate|companion)|(?:her|his|their) (?:protector|provider|savio(?:u)?r|master|purpose|reason to live)|must (?:serve|obey|please|repay|stay with|follow|do (?:whatever|anything|everything))|only (?:he|she|they) can|owes? (?:him|her|them|the player) (?:everything|(?:her|his|their) life)|lives? (?:for|to serve) (?:him|her|them|the player)|belongs? (?:at|by|beside) (?:his|her|their) side|will follow (?:him|her|them|the player) anywhere|devotedly|worships?|obedien(?:t|ce) to)\b/i;
    if (rel.desire < 30 && desireClaims.test(text)) return true;
    if (tropeClaims.test(text)) return true;
    if (positiveStrength < 70 && absoluteClaims.test(text)) return true;
    if (deepTrustClaims.test(text) && !unlocked('trust', 1, 50)) return true;
    if (exceptionalTrustClaims.test(text) && !unlocked('trust', 1, 75)) return true;
    if (deepAffectionClaims.test(text) && !unlocked('affection', 1, 50)) return true;
    if (exceptionalAffectionClaims.test(text) && !unlocked('affection', 1, 75)) return true;
    if (deepDistrustClaims.test(text) && !unlocked('trust', -1, 50)) return true;
    if (deepDislikeClaims.test(text) && !unlocked('affection', -1, 50)) return true;
    // A refused or denied obligation ("does not feel she must repay him") is a boundary, not a claim.
    // The negation must govern the obligation itself: it counts only within the same clause (not
    // across "but/and/because ...") and within a few words of it, and "never doubts that ..." affirms.
    const affirmativeObligation = [...String(text).matchAll(new RegExp(obligationClaims.source, 'gi'))]
        .some(match => {
            const clause = String(text).slice(0, match.index).split(/[,;.]|\b(?:but|and|because|while|although|though|yet|so)\b/i).at(-1) || '';
            const negation = clause.match(/\b(?:not|never|no|nor|without|refuses?\s+to|[a-z]+n[’']t)\b((?:\s+\S+){0,4})\s*$/i);
            return !negation || /\b(?:doubts?|doubted|questions?|questioned|denies|denied|deny)\b/i.test(negation[1]);
        });
    if (affirmativeObligation && !unlocked('trust', 1, 50) && !unlocked('affection', 1, 50)) return true;
    return false;
}

export function relationshipSummaryConsistent(value, relationship = DEFAULT_RELATIONSHIP, context = '', milestones = null) {
    const summary = compactDurableText(value, DURABLE_PROFILE_LIMITS.relationshipSummary, 6);
    if (!summary || relationshipSummaryHasUnsupportedClaims(summary, relationship, milestones)) return false;
    const source = String(context || '').trim();
    if (!source) return true;
    return durableSeedGrounded(summary, source) || durableSemanticSimilarity(summary, source) >= 0.24;
}

export function calibrateRelationshipSummary(value, relationship = DEFAULT_RELATIONSHIP) {
    let summary = compactDurableText(value, DURABLE_PROFILE_LIMITS.relationshipSummary, 6);
    if (!summary) return '';
    const rel = normalizeRelationshipBaseline(relationship || DEFAULT_RELATIONSHIP);
    const positiveStrength = Math.max(0, rel.trust, rel.affection, rel.desire);
    if (positiveStrength < 70) {
        summary = summary
            .replace(/\bindispensable\b/gi, 'important')
            .replace(/\butterly\s+dependent\s+on\b/gi, 'increasingly reliant on')
            .replace(/\bcompletely\s+dependent\s+on\b/gi, 'strongly reliant on')
            .replace(/\b(?:cannot|can['’]?t)\s+live\s+without\b/gi, 'relies deeply on')
            .replace(/\bwould\s+do\s+anything\s+for\b/gi, 'cares deeply for')
            .replace(/\beverything\s+to\s+(her|him|them)\b/gi, 'deeply important to $1');
    }
    if (positiveStrength < 45) {
        summary = summary
            .replace(/\ban important source of physical comfort and survival\b/gi, 'a growing source of practical support and comfort')
            .replace(/\ban important source of survival and physical comfort\b/gi, 'a growing source of practical support and comfort')
            .replace(/\ban important source of (?:her|his|their) survival\b/gi, 'an important source of practical support')
            .replace(/\butterly\s+devoted\s+to\b/gi, 'attached to')
            .replace(/\bunconditionally\s+devoted\s+to\b/gi, 'attached to');
    }
    return compactDurableText(summary, DURABLE_PROFILE_LIMITS.relationshipSummary, 6);
}
