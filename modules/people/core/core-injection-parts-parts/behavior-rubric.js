/* NPC State Delta injection: the compact form of the behavior criteria rubric. */
import { DEFAULT_BEHAVIOR_CRITERIA } from '../core-prompts.js';
import { truncateInjectionText } from './truncate.js';

export function compactInjectionBehaviorRubric(criteria, maxChars) {
    const raw = String(criteria || '').trim();
    if (!raw) return '';
    if (raw === DEFAULT_BEHAVIOR_CRITERIA) {
        return truncateInjectionText('Identity first; relationship only biases player-directed weighting.', maxChars);
    }
    return truncateInjectionText(raw, maxChars);
}
