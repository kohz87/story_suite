// The social check's fixed tables: step sizes, rank bonus cap, skill meter weights, disposition words.

export const RANK_BONUS_MAX = 2;
/** How far from 0 (as a share of the meter's far end, 0..100) earns 1, 2, 3 points. */
export const STEPS = Object.freeze([25, 50, 75]);

/**
 * Which meters each skill reads and which way: +1 a high value helps the player, −1 it works against
 * them. Built-in meters first; the others are the custom meters of Delta's presets (loyalty, respect,
 * rivalry, approval) and two common ones a reader may add (fear, suspicion).
 */
export const SKILL_METERS = Object.freeze({
    persuade: Object.freeze({ trust: 1, tension: -1, loyalty: 1, respect: 1, approval: 1, suspicion: -1, rivalry: -1 }),
    charm: Object.freeze({ affection: 1, desire: 1, tension: -1 }),
    intimidate: Object.freeze({ trust: -1, tension: 1, fear: 1, respect: -1 }),
    deceive: Object.freeze({ trust: 1, tension: -1, suspicion: -1 }),
    social: Object.freeze({ trust: 1, affection: 1, tension: -1, loyalty: 1, respect: 1, approval: 1 }),
});

/** Disposition words (the first word of the slice's `disposition`) and what they give. */
export const DISPOSITION_WORDS = Object.freeze({
    warm: Object.freeze(['friendly', 'warm', 'fond', 'kind', 'grateful', 'loyal', 'devoted', 'cheerful', 'open', 'helpful', 'trusting']),
    cold: Object.freeze(['wary', 'suspicious', 'guarded', 'cold', 'distrustful', 'hostile', 'angry', 'annoyed', 'irritated', 'bitter', 'resentful']),
    afraid: Object.freeze(['afraid', 'scared', 'fearful', 'frightened', 'nervous', 'cowed', 'terrified', 'timid']),
    defiant: Object.freeze(['defiant', 'fearless', 'brave', 'bold', 'unafraid', 'stubborn']),
});
