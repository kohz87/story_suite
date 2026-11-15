/* NPC State Delta morality and agency direction masks and the personality reconciliation of a behavior profile. */
import { normalizeName } from '../core-text.js';
import { containsBehaviorEvolutionLanguage, identityMoralityMarkers } from '../core-durable.js';
import { behaviorProfileKey, behaviorProfileFamily, behaviorProfileBody } from './behavior-keys.js';
import { normalizeBehaviorProfile } from './behavior-normalize.js';

export function behaviorProfileMoralityRelevant(value) {
    return ['disposition', 'cruelty', 'care'].includes(behaviorProfileFamily(value));
}

export function reconcileBehaviorProfileWithPersonality(profile, personality) {
    const markers = identityMoralityMarkers(personality);
    const personalityPolarity = markers.kind && !markers.cruel ? 1 : markers.cruel && !markers.kind ? -1 : 0;
    if (!personalityPolarity) return normalizeBehaviorProfile(profile);
    return normalizeBehaviorProfile(profile).filter(entry => {
        if (!behaviorProfileMoralityRelevant(entry)) return true;
        const polarity = moralityPolarity(entry);
        return !polarity || polarity === personalityPolarity;
    });
}

const BEHAVIOR_DIRECTION_POSITIVE = 1;
const BEHAVIOR_DIRECTION_NEGATIVE = 2;

function moralityDirectionMask(value) {
    const { kind, cruel } = identityMoralityMarkers(behaviorProfileBody(value));
    return (kind ? BEHAVIOR_DIRECTION_POSITIVE : 0) | (cruel ? BEHAVIOR_DIRECTION_NEGATIVE : 0);
}

export function moralityPolarity(value) {
    const mask = moralityDirectionMask(value);
    return mask === BEHAVIOR_DIRECTION_POSITIVE ? 1 : mask === BEHAVIOR_DIRECTION_NEGATIVE ? -1 : 0;
}

function behaviorAgencyDirectionMask(value) {
    const text = normalizeName(`${behaviorProfileKey(value)} ${behaviorProfileBody(value)}`);
    if (!text) return 0;
    // Bounded negation handling for the protected agency axis. "Not independent" is itself
    // negative-agency evidence, while "not obedient" must not be misread as compliance merely
    // because the word obedient is present.
    const negatedIndependence = /\b(?:not|never)\s+(?:fully\s+|truly\s+)?(?:independent|autonomous|self directed)\b/.test(text);
    const positiveText = text.replace(/\b(?:not|never)\s+(?:fully\s+|truly\s+)?(?:independent|autonomous|self directed)\b/g, ' ');
    const complianceText = text.replace(/\b(?:not|never)\s+(?:blindly\s+|fully\s+)?(?:obedient|compliant|submissive)\b/g, ' ');
    const independent = /\b(independence|independent|autonomy|autonomous|self directed|self direction|own judgment|own judgement|own decisions|personal judgment|personal judgement)\b/.test(positiveText);
    const compliant = negatedIndependence
        || /\b(obedience|obedient|compliance|compliant|submission|submissive)\b/.test(complianceText)
        || /\bdefer(?:s|red|ring)?\b.{0,24}\b(?:authority|orders?|instructions?|others?)\b/.test(complianceText)
        || /\bfollows?\b.{0,16}\b(?:orders?|instructions?)\b/.test(complianceText);
    return (independent ? BEHAVIOR_DIRECTION_POSITIVE : 0) | (compliant ? BEHAVIOR_DIRECTION_NEGATIVE : 0);
}

function aggregateBehaviorDirections(entries, classifier) {
    return (Array.isArray(entries) ? entries : []).reduce((mask, entry) => mask | classifier(entry), 0);
}

function behaviorDirectionConflict(existingMask, incomingMask) {
    const establishedPositive = Boolean(existingMask & BEHAVIOR_DIRECTION_POSITIVE);
    const establishedNegative = Boolean(existingMask & BEHAVIOR_DIRECTION_NEGATIVE);
    // Protect an established one-way direction from a proposal that introduces its opposite.
    // If the accepted profile is already contextually mixed, do not freeze it merely because
    // both old and new summaries retain mixed evidence; matching-category safety still applies.
    if (establishedPositive && !establishedNegative) return Boolean(incomingMask & BEHAVIOR_DIRECTION_NEGATIVE);
    if (establishedNegative && !establishedPositive) return Boolean(incomingMask & BEHAVIOR_DIRECTION_POSITIVE);
    return false;
}

export function behaviorProfileRefinementConflict(current, updates) {
    if ((updates || []).some(entry => containsBehaviorEvolutionLanguage(behaviorProfileBody(entry)))) return true;
    const oldMorality = aggregateBehaviorDirections(current, moralityDirectionMask);
    const newMorality = aggregateBehaviorDirections(updates, moralityDirectionMask);
    if (behaviorDirectionConflict(oldMorality, newMorality)) return true;
    const oldAgency = aggregateBehaviorDirections(current, behaviorAgencyDirectionMask);
    const newAgency = aggregateBehaviorDirections(updates, behaviorAgencyDirectionMask);
    return behaviorDirectionConflict(oldAgency, newAgency);
}
