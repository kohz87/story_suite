// How much a foe group's threat multiplies what a fight pays: experience for each foe, and the lesson a fight teaches.

/** By threat index (far beneath … beyond): 0, ½, 1, 2, 3, 4. */
export const THREAT_FACTOR = Object.freeze([0, 0.5, 1, 2, 3, 4]);

/** The factor for a threat index; anything else counts as a fair match (1). */
export function factorOf(threat) {
    return Number.isInteger(threat) && threat >= 0 && threat <= 5 ? THREAT_FACTOR[threat] : 1;
}
