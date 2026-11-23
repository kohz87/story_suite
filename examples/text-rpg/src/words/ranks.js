// Skill ranks: their names and words, the practice scale and the rank a practice total reaches.

const rank = (name, word, bonus) => Object.freeze({ name, word, bonus });

/** The seven skill ranks, from Novice through Legend. */
export const RANKS = Object.freeze([
    rank('Novice', 'knows the basics', 0),
    rank('Apprentice', 'trained', 1),
    rank('Adept', 'skilled', 2),
    rank('Expert', 'expert', 3),
    rank('Master', 'a master', 4),
    rank('Grandmaster', 'among the best alive', 5),
    rank('Legend', 'legendary', 6),
]);

/** Practice points needed for one rank. */
export const PRACTICE_PER_RANK = 100;

/** The highest practice total a skill can hold. */
export const PRACTICE_MAX = 600;

/** The rank reached by a practice total, clamped to 0..600; bad input is treated as 0. */
export function rankOf(practice) {
    const value = typeof practice === 'number' && !Number.isNaN(practice) ? practice : 0;
    const points = Math.min(PRACTICE_MAX, Math.max(0, value));
    const index = Math.floor(points / PRACTICE_PER_RANK);
    const entry = RANKS[index];
    return { index, name: entry.name, word: entry.word, bonus: entry.bonus };
}
