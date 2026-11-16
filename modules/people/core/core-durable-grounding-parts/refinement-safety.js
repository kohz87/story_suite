/* NPC State Delta identity and speech refinement safety: combines unmarked-safety with grounding per field. */

import { containsEvolutionLanguage, identityMoralityConflict } from '../core-durable-identity.js';
import { durableRefinementCandidateGrounded } from './candidate-grounded.js';
import { isSafeUnmarkedDurableRefinement, isSafeUnmarkedDurableReplacement } from './unmarked-safety.js';

export function isSafeIdentityTextRefinement(existing, incoming, context = '', evidenceItems = [], binding = null) {
    return !containsEvolutionLanguage(incoming)
        && !identityMoralityConflict(existing, incoming)
        && isSafeUnmarkedDurableRefinement(existing, incoming)
        && durableRefinementCandidateGrounded('personality', existing, incoming, context, evidenceItems, binding);
}

export function isSafeSpeechRefinement(existing, incoming, context = '', evidenceItems = [], binding = null) {
    return !containsEvolutionLanguage(incoming)
        && isSafeUnmarkedDurableRefinement(existing, incoming)
        && durableRefinementCandidateGrounded('speech', existing, incoming, context, evidenceItems, binding);
}

export function isSafeUnmarkedDurableFieldReplacement(field, existing, incoming) {
    if (!isSafeUnmarkedDurableReplacement(existing, incoming)) return false;
    if (field === 'personality') return isSafeIdentityTextRefinement(existing, incoming);
    if (field === 'speech') return isSafeSpeechRefinement(existing, incoming);
    return isSafeUnmarkedDurableRefinement(existing, incoming);
}
