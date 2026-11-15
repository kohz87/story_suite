// Matches and resolves place names against a world pack's index.

import { indexOf, normalizeName } from './index.js';

// "Blue" alone is too little to stand for "Bluewatch Village".
const MIN_PREFIX = 4;
const WORD_CHAR = /[\p{L}\p{N}]/u;

function containsWord(haystack, needle) {
    for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
        const before = haystack[at - 1];
        const after = haystack[at + needle.length];
        if ((!before || !WORD_CHAR.test(before)) && (!after || !WORD_CHAR.test(after))) return true;
    }
    return false;
}

/**
 * The place named inside `text`: the longest name found as whole words, case-insensitive,
 * curly or straight apostrophes. Failing that, when the whole text is the first word(s) of
 * exactly one place ("Bluewatch" for "Bluewatch Village"), that place.
 */
export function findPlace(pack, text) {
    if (!pack || typeof text !== 'string') return null;
    const haystack = normalizeName(text);
    if (!haystack) return null;
    const { longestFirst } = indexOf(pack);
    for (const [key, name] of longestFirst) {
        if (containsWord(haystack, key)) return name;
    }
    if (haystack.length >= MIN_PREFIX) {
        const hits = longestFirst.filter(([key]) => key.startsWith(`${haystack} `));
        if (hits.length === 1) return hits[0][1];
    }
    return null;
}

/**
 * (0.9.22) Every place named inside `text`, in the order they first appear: whole words,
 * longest names first, so "Bluewatch Village" is found once and not again as a shorter name
 * inside it.
 */
export function placesIn(pack, text) {
    if (!pack || typeof text !== 'string') return [];
    const haystack = normalizeName(text);
    const found = [];
    for (const [key, name] of indexOf(pack).longestFirst) {
        if (found.some(entry => entry.key.includes(key)) || !containsWord(haystack, key)) continue;
        found.push({ key, name, at: haystack.indexOf(key) });
    }
    return found.sort((a, b) => a.at - b.at).map(entry => entry.name);
}

export function resolvePlace(pack, name) {
    if (!pack || typeof name !== 'string') return null;
    return indexOf(pack).byKey.get(normalizeName(name)) ?? findPlace(pack, name);
}
