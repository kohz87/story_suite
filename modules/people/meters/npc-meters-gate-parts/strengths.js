// The gate strengths (how much a repeat gives and when it backfires), their default and the strength rule lookup.

// `less` multiplies a positive meter move; `backfireAt` is the place in the window whose approach backfires.
export const GATE_STRENGTHS = Object.freeze({
    light: Object.freeze({ less: 0.75, backfireAt: 4 }),
    normal: Object.freeze({ less: 0.5, backfireAt: 3 }),
    strong: Object.freeze({ less: 0.25, backfireAt: 2 }),
});

export const DEFAULT_GATE_SETTINGS = Object.freeze({ windowDays: 3, strength: 'normal' });

/** The strength's rule: { less, backfireAt }. */
export function strengthRule(strength) {
    return Object.hasOwn(GATE_STRENGTHS, strength) ? GATE_STRENGTHS[strength] : GATE_STRENGTHS[DEFAULT_GATE_SETTINGS.strength];
}
