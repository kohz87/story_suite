// Story Director v2, names: the identity of a name, without titles, its given name, and whether two names are the same.

import { lineKey } from '../../../changes.js';
import { flat } from './text.js';

// Titles and rank words a name may open with ("Sister Temiwa", "Watch-Captain Roelof"): not part of the given name.
const TITLES = new Set([
    'sister', 'brother', 'father', 'mother', 'bailiff', 'factor', 'junior', 'senior', 'watch', 'captain', 'lord',
    'lady', 'duke', 'duchess', 'prince', 'princess', 'king', 'queen', 'master', 'mistress', 'dame', 'sir', 'madam',
    'mr', 'mrs', 'ms', 'dr', 'old', 'young', 'the', 'a', 'an',
]);

/** The identity of a name: `lineKey` (lower case, punctuation squashed) after accents are taken off ("Élara" is "elara"). '' for a name with no letters or digits. */
export const nameKey = value => lineKey(flat(value).normalize('NFD').replace(/\p{M}/gu, ''));

/** The key without its leading titles ("Sister Temiwa" → "temiwa"); a name that is only titles keeps them. */
export function bareKey(value) {
    const words = nameKey(value).split(' ').filter(Boolean);
    let i = 0;
    while (i < words.length - 1 && TITLES.has(words[i])) i++;
    return words.slice(i).join(' ');
}

/** The given name: the first word of the bare key ('' for no name). */
export const givenKey = value => bareKey(value).split(' ')[0] ?? '';

/** Two names are the same person's name: equal keys, or equal once their titles are dropped. */
export function sameName(left, right) {
    const a = nameKey(left);
    const b = nameKey(right);
    if (!a || !b) return false;
    return a === b || bareKey(left) === bareKey(right);
}
