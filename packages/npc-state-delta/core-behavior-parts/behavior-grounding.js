/* NPC State Delta grounding a behavior profile and collection fields in personality, story text and evidence. */
import { cleanText, normalizeName } from '../core-text.js';
import { DURABLE_PROFILE_LIMITS, durableEvidenceGroundsValue, durableSeedGrounded, durableSemanticSimilarity } from '../core-relationship.js';
import { durableRefinementSupportText, mannerismSimilarity, normalizeMannerisms } from '../core-durable.js';
import { behaviorProfileKey, behaviorProfileFamily, behaviorProfileBody } from './behavior-keys.js';
import { behaviorProfileTargetSpecific, normalizeBehaviorProfile } from './behavior-normalize.js';

export function groundedBehaviorProfile(value, personality = '', context = '', evidenceItems = [], binding = null) {
    const raw = String(context || '').trim();
    // With a binding, only story text about this NPC counts; narration that never mentions it
    // leaves Personality and attributed evidence as the only support.
    const source = raw && binding ? durableRefinementSupportText(raw, [], binding) : raw;
    const evidence = Array.isArray(evidenceItems) ? evidenceItems : [];
    return normalizeBehaviorProfile(value).filter(entry => {
        if (behaviorProfileTargetSpecific(entry)) return false;
        if (!raw) return true; // structured import/manual compatibility
        const body = behaviorProfileBody(entry);
        const identity = cleanText(personality, DURABLE_PROFILE_LIMITS.personality);
        const personalityGrounded = identity && (
            durableSemanticSimilarity(body, identity) >= 0.34
            || durableSemanticSimilarity(entry, identity) >= 0.34
        );
        return Boolean(personalityGrounded || (source && durableSeedGrounded(body, source)) || durableEvidenceGroundsValue(body, evidence));
    });
}

export function strippedDevelopmentEvidence(value) {
    const text = String(value || '').replace(/^\[m\d+\]\s*/i, '');
    const labeled = text.match(/^([^:"“(]{1,52}):\s*(.*)$/s);
    // A label followed only by a quoted line is the claim itself (a Speech style); keep it.
    if (labeled && /^["“‘'].*["”’']\W*$/su.test(labeled[2].trim())) return cleanText(`${labeled[1].trim()} (${labeled[2].trim()})`, DURABLE_PROFILE_LIMITS.evidence);
    return cleanText(labeled ? labeled[2] : text, DURABLE_PROFILE_LIMITS.evidence);
}

export function durableProfileCollectionEquivalent(field, left, right) {
    const normalize = field === 'mannerisms' ? normalizeMannerisms
        : (field === 'behaviorProfile' ? normalizeBehaviorProfile : null);
    if (!normalize) return normalizeName(left) === normalizeName(right);
    const canonical = value => normalize(value).map(item => normalizeName(item)).filter(Boolean).sort();
    const a = canonical(left);
    const b = canonical(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function durableProfileCollectionCandidateGrounded(field, existing, incoming, evidenceItems = []) {
    const isMannerisms = field === 'mannerisms';
    const isBehavior = field === 'behaviorProfile';
    if (!isMannerisms && !isBehavior) return false;
    const current = isMannerisms ? normalizeMannerisms(existing) : normalizeBehaviorProfile(existing);
    const proposed = isMannerisms ? normalizeMannerisms(incoming) : normalizeBehaviorProfile(incoming);
    if (!proposed.length || durableProfileCollectionEquivalent(field, current, proposed)) return false;
    const changed = proposed.filter(entry => {
        if (isMannerisms) return !current.some(old => mannerismSimilarity(old, entry) >= 0.55);
        const key = behaviorProfileKey(entry);
        const family = behaviorProfileFamily(entry);
        const matched = current.find(old => behaviorProfileKey(old) === key
            || (family && behaviorProfileFamily(old) === family));
        return !matched || normalizeName(matched) !== normalizeName(entry);
    });
    if (!changed.length) return false;
    const evidence = (Array.isArray(evidenceItems) ? evidenceItems : [])
        .map(strippedDevelopmentEvidence).filter(Boolean);
    if (!evidence.length) return false;
    return changed.every(entry => evidence.some(sample =>
        durableSeedGrounded(entry, sample)
        || durableSemanticSimilarity(entry, sample) >= 0.34
        || (isBehavior && durableSemanticSimilarity(behaviorProfileBody(entry), sample) >= 0.34)));
}
