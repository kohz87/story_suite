// Folding diacritics and testing whether text mentions a person's name or alias.

// Titles and particles are not names: "a Flame sister" says who someone is, "Temiwa" says which one.
const TITLES = new Set(['sister', 'brother', 'mother', 'father', 'captain', 'lady', 'lord', 'sir', 'dame', 'master', 'mistress', 'old', 'young', 'saint', 'doctor', 'madam', 'king', 'queen', 'prince', 'princess', 'elder', 'lieutenant', 'sergeant', 'knight', 'the', 'and', 'of', 'de', 'la', 'le', 'von', 'van', 'du', 'el', 'al', 'in', 'on', 'at']);

/** A text as lower case with diacritics folded away ("Zoë" is "zoe"). */
export const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
/** The words of a text, folded; any non-letter splits (hyphens, apostrophes, possessives: "Temiwa's" is "temiwa", "s"). */
const wordsOf = text => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const prefixLen = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n += 1; return n; };

// Whether a word of a text is a name token: the same word; in Latin script the token with up to two letters added or taken off its end
// ("Temiwa", "Temiwan", "Temiwas"); in another script (where a name is inflected: "Зоя", "Зои", "Зою") a word of three or more letters that
// shares all but the last letter of the shorter one.
function sameToken(word, token) {
    if (word === token) return true;
    if (!/[^\u0000-\u024f]/.test(token)) {
        const [short, long] = word.length <= token.length ? [word, token] : [token, word];
        return short.length >= 4 && long.length - short.length <= 2 && long.startsWith(short);
    }
    const common = prefixLen(word, token);
    return Math.min(word.length, token.length) >= 3 && common >= Math.min(word.length, token.length) - 1;
}

/**
 * `mentions(text)`: whether a text holds the person's name, an alias or a name-like token: every word of the name, of each alias and of the
 * entry's id (split on any non-letter, diacritics folded, two letters are enough for a whole word) that is not a title, whole or inflected.
 */
export function nameTester(entryOrPerson) {
    const aliases = Array.isArray(entryOrPerson?.aliases) ? entryOrPerson.aliases : [];
    const tokens = new Set();
    for (const name of [entryOrPerson?.name, ...aliases, entryOrPerson?.id ?? entryOrPerson?.eid]) {
        const parts = wordsOf(name);
        for (const part of parts) if (Array.from(part).length >= 2 && !TITLES.has(part)) tokens.add(part);
    }
    return text => wordsOf(text).some(word => [...tokens].some(token => sameToken(word, token)));
}
