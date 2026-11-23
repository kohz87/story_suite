// Stat modifiers, check bonuses and the outcome bands of a d20 roll.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The usual ability modifier: floor((value - 10) / 2), with bad input giving 0. */
export function statMod(value) {
    const stat = finite(value, 10);
    return Math.floor((stat - 10) / 2);
}

/** A check bonus from a stat, rank, level term and hampering; level is kept within 1..99. */
export function rollBonus(input = {}) {
    const { stat, rankBonus, level, hampered } =
        input && typeof input === 'object' ? input : {};
    const levelValue = Math.min(99, Math.max(1, Math.trunc(finite(level, 1))));
    const rank = finite(rankBonus, 0);
    const hindered = typeof hampered === 'boolean'
        ? Number(hampered)
        : Math.max(0, finite(hampered, 0));
    return statMod(stat) + rank + Math.floor(levelValue / 10) - 2 * hindered;
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
