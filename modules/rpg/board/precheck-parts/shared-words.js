// The word and name reading the pre-check shares: one line of text, whole-word name keys, and whether a name occurs in a message.
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on']);
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const oneLine = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const wordsOf = text => String(text ?? '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const IRREGULAR = new Map([['children', 'child'], ['feet', 'foot'], ['geese', 'goose'], ['men', 'man'], ['mice', 'mouse'],
    ['people', 'person'], ['teeth', 'tooth'], ['women', 'woman'], ['wolves', 'wolf']]);
// One word as compared: a plural -s, -es or -ies is read as its singular. The same word still has to occur whole.
function singular(word) {
    if (IRREGULAR.has(word)) return IRREGULAR.get(word);
    if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (word.length > 4 && /(?:ches|shes|sses|xes|zes)$/u.test(word)) return word.slice(0, -2);
    return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

export const nameKey = text => wordsOf(text).map(singular).filter(word => !STOP.has(word)).join('\u0000');
const distinctiveWords = text => wordsOf(text).map(singular).filter(word => !STOP.has(word));

/** Whether every distinctive word of `name` (plurals are fine) appears whole in `message` or in `previous` (the reply just before it, which introduced the foes). */
export function namedInMessage(name, message, previous = '') {
    const wanted = distinctiveWords(name);
    if (!wanted.length) return false;
    const seen = new Set([...wordsOf(message), ...wordsOf(previous)].map(singular));
    return wanted.every(word => seen.has(word));
}
