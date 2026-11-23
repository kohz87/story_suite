// Difficulty words and their target numbers.

const words = [
    { word: 'trivial', dc: 5 },
    { word: 'easy', dc: 10 },
    { word: 'ordinary', dc: 15 },
    { word: 'hard', dc: 20 },
    { word: 'very hard', dc: 25 },
    { word: 'near impossible', dc: 30 },
];

/** The six difficulty words and their target numbers, in rising order. */
export const DIFFICULTIES = Object.freeze(words.map(item => Object.freeze({ ...item })));

// Older wording a narrator may still write.
const ALIASES = Object.freeze({ normal: 'ordinary' });

const wordOf = text => {
    const word = typeof text === 'string' ? text.trim().toLowerCase() : '';
    return Object.hasOwn(ALIASES, word) ? ALIASES[word] : word;
};

/** Says whether a text is a difficulty word (`normal` counts: it is `ordinary`). */
export function isDifficultyWord(text) {
    return DIFFICULTIES.some(item => item.word === wordOf(text));
}

/** The position of a difficulty word, without case; an unknown word is ordinary (2). */
export function difficultyIndex(word) {
    const index = DIFFICULTIES.findIndex(item => item.word === wordOf(word));
    return index < 0 ? 2 : index;
}
