/* NPC State Delta profile evidence: telling whether two evidence items describe the same concept. */
import { DURABLE_PROFILE_LIMITS, durableSemanticSimilarity } from '../core-relationship.js';
import { cleanText, normalizeName } from '../core-text.js';

function profileEvidenceConcept(value) {
    // A [mN] source tag is provenance, not part of the label, so tagged evidence still matches by category.
    const text = cleanText(String(value || '').replace(/^\[m\d+\]\s*/i, ''), DURABLE_PROFILE_LIMITS.evidence);
    const match = text.match(/^([\p{L}\p{N}][\p{L}\p{N} _\-/]{1,48})\s*:\s*(.+)$/u);
    return match ? normalizeName(match[1]) : '';
}

export function profileEvidenceRelated(a, b) {
    const aTag = profileEvidenceConcept(a);
    const bTag = profileEvidenceConcept(b);
    if (aTag && bTag) return aTag === bTag || durableSemanticSimilarity(aTag, bTag) >= 0.72;
    return durableSemanticSimilarity(a, b) >= 0.48;
}

export function durableProfileEvidenceRelated(a, b) {
    return profileEvidenceRelated(a, b);
}
