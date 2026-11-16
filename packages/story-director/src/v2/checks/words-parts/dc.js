// Outcome of a die roll against a difficulty, and the difficulty words a change line may write.

export function outcomeOf(die, mod, dc) {
    const meets = die + mod >= dc;
    if (die === 20 && meets) return 'crit';
    if (die === 1) return 'critfail';
    return meets ? 'success' : 'fail';
}

export const DC_WORDS = Object.freeze({
    trivial: 5, easy: 10, normal: 15, ordinary: 15, medium: 15, moderate: 15, average: 15,
    hard: 20, difficult: 20, tough: 20, 'very hard': 25, heroic: 25, 'near-impossible': 30, 'nearly impossible': 30, impossible: 30,
});

/** The difficulty a change line writes: a word of the table or a number from 1 to 40 -> the number, else null. */
export function dcOf(value) {
    if (Number.isInteger(value)) return value >= 1 && value <= 40 ? value : null;
    const text = String(value ?? '').trim().toLowerCase().replace(/^dc\s*/, '');
    if (/^\d+$/.test(text)) return Number(text) >= 1 && Number(text) <= 40 ? Number(text) : null;
    return Object.hasOwn(DC_WORDS, text) ? DC_WORDS[text] : null;
}
