// The caught-lie rule (extreme tier, drop of 6) and the trust change it makes.

// The owner's decision (10 Nov): a caught lie is an extreme-tier trust drop of 6. The one place it is written; npc-notes-kinds.js re-exports it.
export const CAUGHT_TIER = 'extreme';
export const CAUGHT_DROP = 6;

/**
 * The meter change a caught lie makes, for run(): trust down by `drop` at `tier` (both are the owner's settings; the defaults
 * are CAUGHT_TIER and CAUGHT_DROP, the owner's decision).
 */
export function caughtChange(tier = CAUGHT_TIER, drop = CAUGHT_DROP) {
    return { changes: [{ meter: 'trust', mode: 'add', value: -drop }], impact: { tier } };
}
