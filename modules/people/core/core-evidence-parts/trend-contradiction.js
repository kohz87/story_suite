/* NPC State Delta profile evidence: whether a new observation contradicts a pending development trend. */
import { normalizeName } from '../core-text.js';
import { strippedDevelopmentEvidence } from '../core-behavior.js';
import { durableClaimHasNegation, durableClaimPolarityConflict } from './claim-polarity.js';

// Opposite tendencies that break a pending development trend: a later sighting of the other side
// means the trend did not hold. Each pair is a pair of word stems.
const DEVELOPMENT_TREND_OPPOSITES = [
    ['confiden', 'timid'], ['confiden', 'hesitan'], ['confiden', 'insecur'], ['bold', 'meek'], ['bold', 'shy'],
    ['assertiv', 'submissiv'], ['assertiv', 'docile'], ['assertiv', 'deferen'], ['independen', 'dependen'],
    ['independen', 'relian'], ['calm', 'anxious'], ['calm', 'panick'], ['warm', 'cold'], ['trusting', 'distrust'],
    ['trusting', 'suspicio'], ['cheerful', 'gloom'], ['open', 'guarded'], ['outspoken', 'silent'], ['proud', 'asham'],
    ['hopeful', 'despair'], ['decisive', 'indecisi'], ['patient', 'impatien'],
];

// True when a new observation contradicts a pending one: an opposite tendency, or the same claim
// negated. Used to break a development trend before it can accumulate further.
export function durableEvidenceContradicts(pending, incoming) {
    const left = strippedDevelopmentEvidence(pending);
    const right = strippedDevelopmentEvidence(incoming);
    if (!left || !right) return false;
    if (durableClaimPolarityConflict(left, right)) return true;
    if (durableClaimHasNegation(left) || durableClaimHasNegation(right)) return false;
    const words = text => normalizeName(text).split(/\s+/).filter(Boolean);
    const has = (list, stem) => list.some(word => word.startsWith(stem));
    const a = words(left);
    const b = words(right);
    return DEVELOPMENT_TREND_OPPOSITES.some(([x, y]) => (has(a, x) && has(b, y) && !has(a, y) && !has(b, x))
        || (has(a, y) && has(b, x) && !has(a, x) && !has(b, y)));
}
