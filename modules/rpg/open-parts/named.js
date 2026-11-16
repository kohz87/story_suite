// Decides whether a foe's name is spoken in the reader's text, by its distinctive words.
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on']);

// A word as compared: lower case, a plural -s ignored.
const stem = word => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);
const wordsOf = text => String(text ?? '').normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem);

/** The distinctive words of a foe's name: not an article or a small joining word. */
export const distinctiveWords = name => wordsOf(name).filter(word => !STOP.has(word));

/** Whether at least one distinctive word of `name` appears, as a whole word, in any of `texts` (the reader's message, the shown text before). */
export function isNamedIn(name, texts) {
    const wanted = distinctiveWords(name);
    if (!wanted.length) return false;
    const seen = new Set(texts.flatMap(wordsOf));
    return wanted.some(word => seen.has(word));
}
