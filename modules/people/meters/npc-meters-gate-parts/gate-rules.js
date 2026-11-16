// The fixed names and thresholds of the gate: its source, its outcome modes, the low-trust line and the backfire step.

export const GATE_SOURCE = 'story';
export const GATE_MODES = Object.freeze({ less: 'less', back: 'backfired', susp: 'suspicion' });
export const GATE_LOW_TRUST_BELOW = -20;
export const GATE_BACKFIRE_STEP = 1;
