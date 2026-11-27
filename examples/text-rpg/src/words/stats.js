// Words for the seven stats: their band names, the default table and band lookup.

/** The seven stat keys, in sheet order. */
export const STAT_KEYS = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);

const frozenWords = (...words) => Object.freeze(words);

/** Default stat words, one list per stat for bands 1-4 through 25-30. */
export const DEFAULT_STAT_WORDS = Object.freeze({
    str: frozenWords('feeble', 'ordinary', 'strong', 'very strong', 'mighty', 'superhuman'),
    vit: frozenWords('frail', 'ordinary', 'hardy', 'tireless', 'iron-bodied', 'unbreakable'),
    agi: frozenWords('sluggish', 'ordinary', 'quick', 'fast', 'blurring', 'superhuman'),
    dex: frozenWords('fumbling', 'ordinary', 'deft', 'precise', 'flawless', 'superhuman'),
    int: frozenWords('slow-witted', 'ordinary', 'sharp', 'brilliant', 'a rare mind', 'genius beyond peers'),
    wis: frozenWords('heedless', 'ordinary', 'perceptive', 'insightful', 'far-seeing', 'sage'),
    cha: frozenWords('off-putting', 'ordinary', 'likeable', 'commanding', 'magnetic', 'legendary presence'),
});

/**
 * The table band for a stat value, 0 through 5. Values below 1 give band 0,
 * values above 30 give band 5, and non-numbers give band 1.
 */
export function statBand(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 1;
    if (value < 1) return 0;
    if (value > 30) return 5;
    if (value < 5) return 0;
    if (value < 10) return 1;
    if (value < 15) return 2;
    if (value < 20) return 3;
    if (value < 25) return 4;
    return 5;
}

/** The word for one stat at a value; an unknown stat or unusable table gives ''. */
export function statWord(stat, value, table = DEFAULT_STAT_WORDS) {
    if (typeof stat !== 'string' || !table || typeof table !== 'object') return '';
    const words = table[stat];
    if (!Array.isArray(words)) return '';
    const word = words[statBand(value)];
    return typeof word === 'string' ? word : '';
}
