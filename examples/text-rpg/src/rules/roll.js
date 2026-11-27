// What a story roll adds (the skill's rank, not stats, gear or level) and the outcome bands of a d20 roll.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The usual ability modifier: floor((value - 10) / 2), with bad input giving 0. */
export function statMod(value) {
    const stat = finite(value, 10);
    return Math.floor((stat - 10) / 2);
}

/** What each rank step adds to a roll (Novice 0 … Legend 12), and what naming a skill the character does not have costs. */
const RANK_STEP = 2;
const UNLEARNED = -3;

/**
 * A story roll's bonus: rank × 2 (`rank` is the Text RPG rank index, 0..6), −3 for a skill that is not on the sheet (`unlearned`), less 2 for each
 * injury hampering the try's stat. A plain stat try is +0: stats, gear and level are not in the roll.
 */
export function rollBonus(input = {}) {
    const { rank, unlearned, hampered } = input && typeof input === 'object' ? input : {};
    const rankTerm = RANK_STEP * Math.min(6, Math.max(0, Math.trunc(finite(rank, 0))));
    const hindered = typeof hampered === 'boolean' ? Number(hampered) : Math.max(0, finite(hampered, 0));
    return rankTerm + (unlearned ? UNLEARNED : 0) - 2 * hindered;
}

/**
 * The band, total, margin and quality of a d20 check; a die outside 1..20 gives null. The band comes from the margin alone (at the number or over:
 * success; 1–2 short: cost; 3–9 short: failure; 10 or more short: bad). A natural 20 is 'well done' and a natural 1 'clumsy': quality only, never the band.
 */
export function verdict(input = {}) {
    const { die, bonus, dc } = input && typeof input === 'object' ? input : {};
    if (typeof die !== 'number' || !Number.isInteger(die) || die < 1 || die > 20) return null;
    const total = die + finite(bonus, 0);
    const margin = total - finite(dc, 15);

    let band;
    if (margin >= 0) band = 'success';
    else if (margin >= -2) band = 'cost';
    else if (margin >= -9) band = 'failure';
    else band = 'bad';

    return { band, total, margin, quality: die === 20 ? 'well done' : die === 1 ? 'clumsy' : null };
}
