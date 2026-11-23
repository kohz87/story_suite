// Foe threat: tier adjustments and the words for a foe's strength relative to a hero.

/** Level adjustment for each foe tier. */
export const TIER_SHIFT = Object.freeze({
    mob: -6,
    minion: -3,
    standard: 0,
    elite: 5,
    boss: 10,
    apex: 25,
});

/** Threat words, from far beneath the hero through beyond them. */
export const THREAT_WORDS = Object.freeze([
    'far beneath you',
    'beneath you',
    'a fair match',
    'above you',
    'far above you',
    'beyond you',
]);

const levelOf = value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    return Math.min(99, Math.max(1, value));
};

/** The threat band, 0 through 5, for a foe level and tier against a hero level. */
export function threatIndex(foeLevel, tier, heroLevel) {
    const foe = levelOf(foeLevel);
    const hero = levelOf(heroLevel);
    const shift = Object.hasOwn(TIER_SHIFT, tier) ? TIER_SHIFT[tier] : 0;
    const gap = foe + shift - hero;

    if (gap <= -10) return 0;
    if (gap <= -4) return 1;
    if (gap <= 3) return 2;
    if (gap <= 9) return 3;
    if (gap <= 19) return 4;
    return 5;
}

/** The threat word for a foe level and tier against a hero level. */
export function threatWord(foeLevel, tier, heroLevel) {
    return THREAT_WORDS[threatIndex(foeLevel, tier, heroLevel)];
}
