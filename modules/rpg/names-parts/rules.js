// Names: the roll formula, pacing, foe slots and the reply's limits.

/** The formula (SPEC_RPG §0): PC d20 + stat/2 + 2×class + skill rank vs foe d20 + 5 + 2×class. */
export const FORMULA = Object.freeze({ die: 20, statDivisor: 2, classWeight: 2, foeBase: 5, edgeMax: 3, costMargin: 2 });

/** Pacing: exchanges per reply. (Only `careful` limits a reply: 1 exchange; the others run to the cap.) */
export const PACE = Object.freeze({ careful: 1, normal: 5, all: 8 });

/** Foe slots of a Foes block: `foe1`…`foe6` (an older block has 1…4). */
export const FOE_SLOTS = 6;

/**
 * What bounds a reply's rolls (SPEC_RPG_v1 §4.5.3): at most `roundCap` rounds whatever the pace says, a round that
 * holds a natural 1 or 20 or a margin of `decisiveMargin` either way is the last, and the cue stays within
 * `cueTokens` (about four characters each). `dc` is the number a check's difficulty word stands for.
 */
export const LIMITS = Object.freeze({
    // The cap of a roll made before the flow of stage 49 (`flow` absent in its payload): such a roll, and one recorded with no numbers at all, keeps it.
    roundCap: 5,
    // The most exchanges one reply holds by default (every preset; Custom may pick 1 to 8): a fight now runs until something happens (resolve.js).
    roundCapDefault: 8,
    decisiveMargin: 8,
    cueTokens: 600,
    dc: Object.freeze({ easy: 10, normal: 15, hard: 20, 'very hard': 25 }),
    acts: 6,
    foes: FOE_SLOTS,
    checks: 4,
});
