// Story Director v2, tracker part (initiative): words the Initiative line, static and per reply.

import { cutPoints } from '../scene.js';

/** The Director's static line while the feature is on: the same bytes every reply. */
export const INITIATIVE_STATIC = "Initiative: whoever the note names under Initiative takes the first step (approach, interrupt or ask) where the scene allows; {{user}}'s part stays theirs.";

/** "Initiative: Elula may approach {{user}} about Wolf Contract." */
export function initiativeLine(candidate) {
    if (!candidate) return '';
    const name = cutPoints(candidate.name, 60);
    if (!candidate.topic) return `Initiative: ${name} may approach {{user}}.`;
    return candidate.dueNow ? `Initiative: ${name} may interrupt about ${candidate.topic}.` : `Initiative: ${name} may approach {{user}} about ${candidate.topic}.`;
}
