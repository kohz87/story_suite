/* NPC State Delta profile evidence: the evidence size limits and the per-family retention of behavioral-lever evidence. */
import { DURABLE_PROFILE_LIMITS, semanticDedupeItems } from '../core-relationship.js';
import { cleanList } from '../core-text.js';
import { behaviorProfileFamily } from '../core-behavior.js';

export const PROFILE_EVIDENCE_LIMIT = 4;

// Behavioral Lever evidence keeps up to two recent observations per lever category (four
// uncategorised), so a second sighting of one tendency is not rotated out by unrelated behaviour
// before it arrives. Scanner prompts still carry only the newest PROFILE_EVIDENCE_LIMIT items.
export const BEHAVIOR_EVIDENCE_LIMIT = 12;
const BEHAVIOR_EVIDENCE_PER_FAMILY = 2;

export function retainBehaviorEvidence(items) {
    const deduped = semanticDedupeItems(cleanList(items, BEHAVIOR_EVIDENCE_LIMIT * 2, DURABLE_PROFILE_LIMITS.evidence), {
        maxItems: BEHAVIOR_EVIDENCE_LIMIT * 2,
        maxChars: DURABLE_PROFILE_LIMITS.evidence,
        similarity: 0.56,
    });
    const counts = new Map();
    const kept = [];
    for (let i = deduped.length - 1; i >= 0 && kept.length < BEHAVIOR_EVIDENCE_LIMIT; i -= 1) {
        const family = behaviorProfileFamily(String(deduped[i]).replace(/^\[m\d+\]\s*/i, ''));
        const used = counts.get(family) || 0;
        if (used >= (family ? BEHAVIOR_EVIDENCE_PER_FAMILY : PROFILE_EVIDENCE_LIMIT)) continue;
        counts.set(family, used + 1);
        kept.unshift(deduped[i]);
    }
    return kept;
}
