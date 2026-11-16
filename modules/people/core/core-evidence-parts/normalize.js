/* NPC State Delta profile evidence: the empty, normalized, prompt-sized and counted forms of a profile-evidence record. */
import { DURABLE_PROFILE_LIMITS, semanticDedupeItems } from '../core-relationship.js';
import { cleanList } from '../core-text.js';
import { PROFILE_EVIDENCE_FIELDS } from '../src/fields/registry.js';
import { PROFILE_EVIDENCE_LIMIT, retainBehaviorEvidence } from './shared-retention.js';

export function emptyProfileEvidence() {
    return { personality: [], speech: [], appearance: [], mannerisms: [], behaviorProfile: [] };
}

export function normalizeProfileEvidence(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalize = list => semanticDedupeItems(cleanList(list, PROFILE_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence), {
        maxItems: PROFILE_EVIDENCE_LIMIT,
        maxChars: DURABLE_PROFILE_LIMITS.evidence,
        similarity: 0.56,
    });
    return {
        personality: normalize(source.personality),
        speech: normalize(source.speech),
        appearance: normalize(source.appearance),
        mannerisms: normalize(source.mannerisms),
        behaviorProfile: retainBehaviorEvidence(source.behaviorProfile ?? source.behavior_profile),
    };
}

// The evidence a scanner prompt carries: every field at its ordinary size.
export function promptProfileEvidence(value = {}) {
    const evidence = normalizeProfileEvidence(value);
    return { ...evidence, behaviorProfile: evidence.behaviorProfile.slice(-PROFILE_EVIDENCE_LIMIT) };
}

export function profileEvidenceCount(value = {}) {
    const normalized = normalizeProfileEvidence(value);
    return PROFILE_EVIDENCE_FIELDS.reduce((sum, field) => sum + normalized[field].length, 0);
}
