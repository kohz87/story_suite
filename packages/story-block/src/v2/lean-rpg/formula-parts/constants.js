// The Standard formula's fixed tables: the stat keys, the roll types, Standard's numbers and each roll type's default stats.

/** The seven stats, in sheet order. */
export const STAT_KEYS = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha']);

/** What a roll is for. A support action (healing, a buff) rolls its skill's type against a difficulty. */
export const ROLL_TYPES = Object.freeze(['physical', 'magic', 'defence', 'social', 'check']);

/** Standard's numbers. Packs may set their own (the build reads them from the rules payload, never from today's settings on replay). */
export const STANDARD_NUMBERS = Object.freeze({
    startStat: 5,          // every stat at creation
    createPoints: 10,      // points to spend at creation
    createMin: 3,          // lowest a stat may go at creation
    createMax: 10,         // highest a stat may go at creation
    pointsPerSoul: 4,      // points with each Soul Class rise
    statMax: 20,           // highest a stat may ever be
    foeBase: 3,            // foe: d20 + foeBase + foeClassWeight × class (tuned by simulation in the build)
    foeClassWeight: 3,
    quickStartMargin: 10,  // turn-order lead over a foe that earns one opening action against it
});

/** The default main and second stat of each roll type (defence is decided by the stats: see statPart). */
export const TYPE_STATS = Object.freeze({
    physical: Object.freeze({ main: 'str', second: 'dex' }),
    magic: Object.freeze({ main: 'int', second: 'dex' }),
    social: Object.freeze({ main: 'cha', second: 'int' }),
    check: Object.freeze({ main: 'str', second: 'dex' }),
});
