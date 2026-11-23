// Stat modifiers, check bonuses and the outcome bands of a d20 roll.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The usual ability modifier: floor((value - 10) / 2), with bad input giving 0. */
export function statMod(value) {
    const stat = finite(value, 10);
    return Math.floor((stat - 10) / 2);
}

/** The RPG's rank term (0..3) for each Text RPG rank, Novice through Legend: Novice and Apprentice 0, Adept 1, Expert 2, Master and above 3. */
const RANK_TERM = Object.freeze([0, 0, 1, 2, 3, 3, 3]);

/**
 * A story check's bonus, the RPG's Check roll: floor(level / 5) + floor((stat + DEX / 2) / 2) + rank term, less 2 for each hampering injury.
 * Adapted from modules/rpg/formula-parts/stat-part.js (pair) and levels.js (levelBonus) (keep in step when those change).
 * `stat` is the fitting (or the skill's own) stat, `dex` the second stat, `rank` the Text RPG rank index (0..6); level is kept within 1..99.
 */
export function rollBonus(input = {}) {
    const { stat, dex, rank, level, hampered } = input && typeof input === 'object' ? input : {};
    const levelTerm = Math.floor(Math.min(99, Math.max(1, Math.trunc(finite(level, 1)))) / 5);
    const statTerm = Math.floor((2 * finite(stat, 10) + finite(dex, 10)) / 4);
    const rankTerm = RANK_TERM[Math.min(RANK_TERM.length - 1, Math.max(0, Math.trunc(finite(rank, 0))))];
    const hindered = typeof hampered === 'boolean'
        ? Number(hampered)
        : Math.max(0, finite(hampered, 0));
    return levelTerm + statTerm + rankTerm - 2 * hindered;
}

/** The band, total and margin of a d20 check; a die outside 1..20 gives null. */
export function verdict(input = {}) {
    const { die, bonus, dc } = input && typeof input === 'object' ? input : {};
    if (typeof die !== 'number' || !Number.isInteger(die) || die < 1 || die > 20) return null;
    const total = die + finite(bonus, 0);
    const margin = total - finite(dc, 12);

    let band;
    if (die === 20) band = 'great';
    else if (die === 1) band = 'bad';
    else if (margin >= 0) band = 'success';
    else if (margin >= -2) band = 'cost';
    else if (margin >= -9) band = 'failure';
    else band = 'bad';

    return { band, total, margin };
}
