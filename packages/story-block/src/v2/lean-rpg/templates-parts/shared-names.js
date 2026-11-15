// Turns a list of words into a `names` map for a field (the key is the word's index plus `first`).

export const names = (words, first = 0) => Object.fromEntries(words.map((word, index) => [String(index + first), word]));
