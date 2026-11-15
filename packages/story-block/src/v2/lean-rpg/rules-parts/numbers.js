// The names of the settings and the Standard formula's number keys and ranges.

/** The settings (Story Block's own bucket): the difficulty word. */
export const DIFFICULTY_SETTING = 'rpgDifficulty';

/** The Custom numbers of the Standard formula (an object of STANDARD_RULE_KEYS). */
export const STANDARD_SETTING = 'rpgStandard';

/** Standard's numbers in the order they are stored and shown (the first is the formula itself). */
export const STANDARD_RULE_KEYS = Object.freeze(['formula', 'foeBase', 'foeClassWeight', 'classWeight', 'costMargin', 'decisiveMargin', 'roundCap',
    'startStat', 'createPoints', 'createMin', 'createMax', 'pointsPerSoul', 'statMax', 'quickStartMargin']);

/** What each of Standard's numbers may be (whole numbers, `min` to `max`). */
export const STANDARD_RANGES = Object.freeze({
    foeBase: Object.freeze({ min: 0, max: 15 }),
    foeClassWeight: Object.freeze({ min: 1, max: 5 }),
    classWeight: Object.freeze({ min: 1, max: 3 }),
    costMargin: Object.freeze({ min: 0, max: 5 }),
    decisiveMargin: Object.freeze({ min: 4, max: 15 }),
    roundCap: Object.freeze({ min: 1, max: 8 }),
    startStat: Object.freeze({ min: 1, max: 10 }),
    createPoints: Object.freeze({ min: 0, max: 30 }),
    createMin: Object.freeze({ min: 1, max: 10 }),
    createMax: Object.freeze({ min: 3, max: 20 }),
    pointsPerSoul: Object.freeze({ min: 0, max: 10 }),
    statMax: Object.freeze({ min: 10, max: 20 }),
    quickStartMargin: Object.freeze({ min: 1, max: 30 }),
});
