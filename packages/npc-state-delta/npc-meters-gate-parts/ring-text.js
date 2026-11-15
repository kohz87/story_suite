// The recent-approach ring as stored text: reading it back and writing it.
import { approachRingProblems, normalizeApproachRing } from './ring.js';

// ---- the stored ring, the settings and the story-line wiring (src/npc-meters.js) ----
export const GATE_RING_TEXT_MAX = 1200;

/** The ring held in stored text, or null when the text is absent or not valid in every entry. */
export function readApproachRing(text) {
    if (typeof text !== 'string' || !text || text.length > GATE_RING_TEXT_MAX) return null;
    let value;
    try { value = JSON.parse(text); } catch { return null; }
    return approachRingProblems(value).length ? null : value;
}

/** The ring as the text the record stores. */
export const approachRingText = ring => JSON.stringify(normalizeApproachRing(ring));
