/* NPC State Delta profile evidence: whether a field's new evidence is a later sighting that makes gradual evolution ready. */
import { DURABLE_PROFILE_LIMITS, durableSemanticSimilarity } from '../core-relationship.js';
import { cleanList, normalizeName } from '../core-text.js';
import { BEHAVIOR_EVIDENCE_LIMIT, PROFILE_EVIDENCE_LIMIT } from './shared-retention.js';
import { profileEvidenceRelated } from './related.js';

// (1.2.11) The message an evidence item was seen in ("[m12] …"), or '' when it carries no tag.
const evidenceSource = item => (String(item ?? '').match(/^\s*\[m(\d+)\]/i) ?? [])[1] ?? '';

function newProfileEvidence(prior = [], incoming = [], duplicateSimilarity = 0.56) {
    const before = cleanList(prior, BEHAVIOR_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence);
    return cleanList(incoming, PROFILE_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence).filter(item =>
        !before.some(old => {
            if (normalizeName(old) === normalizeName(item)) return true;
            // (1.2.11) Seen in another message is another sighting, however alike the words: only a
            // re-read of the same message (or untagged near-copies) is a duplicate.
            const was = evidenceSource(old);
            const now = evidenceSource(item);
            if (was && now && was !== now) return false;
            return durableSemanticSimilarity(old, item) >= duplicateSimilarity;
        }));
}

// A lever swing needs the behaviour seen again in a later scene. Two scenes of the same behaviour
// are often narrated in similar words, so for Behavioral Levers only a near-copy (a replayed or
// re-scanned observation) is a duplicate; related but distinct wording counts as a second sighting.
// (1.2.11) So for Mannerisms: a habit is the same act again, in much the same words.
const BEHAVIOR_EVIDENCE_DUPLICATE_SIMILARITY = 0.85;
const REPEAT_EVIDENCE_FIELDS = new Set(['behaviorProfile', 'mannerisms']);

export function gradualProfileEvolutionReady(field, beforeEvidence, incomingEvidence) {
    const prior = beforeEvidence[field] || [];
    const fresh = newProfileEvidence(prior, incomingEvidence[field] || [],
        REPEAT_EVIDENCE_FIELDS.has(field) ? BEHAVIOR_EVIDENCE_DUPLICATE_SIMILARITY : 0.56);
    if (!prior.length || !fresh.length) return false;
    return fresh.some(now => prior.some(old => profileEvidenceRelated(old, now)));
}
