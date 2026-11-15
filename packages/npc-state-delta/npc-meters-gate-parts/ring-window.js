// The ring entries that count against a reply, and adding a reply's approach to the ring.
import { RECENT_APPROACH_MAX, normalizeApproachRing } from './ring.js';

/**
 * The entries that count against this reply: the same story days as the window (`day` back `windowDays` - 1 days, to `day`)
 * and not this reply's own entry, so a re-read of the same reply counts the same as its first read.
 */
export function priorApproaches(ring, { day, reply, windowDays }) {
    const first = day - windowDays + 1;
    return normalizeApproachRing(ring).filter(entry => entry.d >= first && entry.d <= day && entry.r !== reply);
}

/** The ring with this reply's approach added (replacing any earlier entry of the same reply), capped at RECENT_APPROACH_MAX. */
export function addApproach(ring, { day, reply, kind }) {
    const kept = normalizeApproachRing(ring).filter(entry => entry.r !== reply);
    return [...kept, { d: day, r: reply, v: kind }].slice(-RECENT_APPROACH_MAX);
}
