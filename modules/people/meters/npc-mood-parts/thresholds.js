// The fixed thresholds of the mood: the band edge and the trust-change sizes that make a drop or a betrayal.

export const MOOD_BAND_EDGE = 2; // |axis| >= 2 is a band; -1..1 reads as neutral
// The story's own steps are small (a line moves a person at most 1 / 2 / 3 / 6 points by its impact tier), so the thresholds are too.
export const TRUST_DROP_MIN = 2; // a trust change of -2 or worse in one reply is a trust drop
export const BETRAYAL_TRUST = 6; // a trust change of -6 or worse is a betrayal; so is -3 or worse at a major/extreme impact
export const SEVERE_DROP_MIN = 3;
