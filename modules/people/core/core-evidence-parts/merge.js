/* NPC State Delta profile evidence: merging the recent evidence of one field, and of a whole evidence record, with dedupe. */
import { DURABLE_PROFILE_LIMITS, semanticDedupeItems } from '../core-relationship.js';
import { cleanList } from '../core-text.js';
import { PROFILE_EVIDENCE_FIELDS } from '../../fields/registry.js';
import { PROFILE_EVIDENCE_LIMIT, retainBehaviorEvidence } from './shared-retention.js';
import { normalizeProfileEvidence } from './normalize.js';

export function mergeRecentProfileEvidence(existing = [], incoming = [], field = '') {
    if (field === 'behaviorProfile') return retainBehaviorEvidence([...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]);
    return semanticDedupeItems([
        ...cleanList(existing, PROFILE_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence),
        ...cleanList(incoming, PROFILE_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence),
    ], {
        maxItems: PROFILE_EVIDENCE_LIMIT,
        maxChars: DURABLE_PROFILE_LIMITS.evidence,
        similarity: 0.56,
    });
}

export function mergeProfileEvidence(existing = {}, incoming = {}) {
    const before = normalizeProfileEvidence(existing);
    const added = normalizeProfileEvidence(incoming);
    return Object.fromEntries(PROFILE_EVIDENCE_FIELDS.map(field => [
        field, mergeRecentProfileEvidence(before[field], added[field], field),
    ]));
}
