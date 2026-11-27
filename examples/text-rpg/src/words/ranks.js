// Skill ranks: their names and words, each rank's practice threshold (`at`: 0, 40, 100, 180, 280, 420, 600) and the rank a practice total reaches.

const rank = (name, word, bonus, at) => Object.freeze({ name, word, bonus, at });

/** The seven skill ranks, from Novice through Legend, each with the practice total (`at`) that reaches it. */
export const RANKS = Object.freeze([
    rank('Novice', 'knows the basics', 0, 0),
    rank('Apprentice', 'trained', 1, 40),
    rank('Adept', 'skilled', 2, 100),
    rank('Expert', 'expert', 3, 180),
    rank('Master', 'a master', 4, 280),
    rank('Grandmaster', 'among the best alive', 5, 420),
    rank('Legend', 'legendary', 6, 600),
]);

/** The highest practice total a skill can hold. */
export const PRACTICE_MAX = 600;

/** The rank reached by a practice total, clamped to 0..600; bad input is treated as 0. */
export function rankOf(practice) {
    const value = typeof practice === 'number' && !Number.isNaN(practice) ? practice : 0;
    const points = Math.min(PRACTICE_MAX, Math.max(0, value));
    const index = RANKS.findLastIndex(entry => points >= entry.at);
    const entry = RANKS[index];
    return { index, name: entry.name, word: entry.word, bonus: entry.bonus };
}
