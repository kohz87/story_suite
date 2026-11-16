// Tolerant name keys: a name without its portion words, and the word-order-insensitive key. Pure.

import { aliasKey } from './clean.js';

// ---------- tolerant lookup (fetch quests, recipes, `- item` lines) ----------
//
// The story writes the same thing in many ways: "a handful of moonpetals", "some rope", "two pieces of
// chalk", "alloy of sulfur (piece)" for "Sulfur Alloy". When the exact name and its singular/plural miss,
// the lookup tries the name without its portion words, and then a key that ignores word order: the
// name's words without portion and stop words, each made singular, sorted. Only a fallback: an exact
// alias or name always wins, and a key two defs share is ambiguous like any other.

// Portion and measure words before a thing ("a handful of", "pieces of", "a pair of", "a few").
const PORTION_WORDS = 'handful|piece|pair|bit|chunk|pinch|lump|bunch|portion|slice|scrap|sprig|strip|dash|drop|length|coil|bundle|heap|pile|couple|scoop|measure|dose|helping|sack|sliver';
const PORTION = new RegExp(`^(?:(?:a|an|one|two|three|four|five|a few|few|several|some|\\d+)\\s+)?(?:${PORTION_WORDS})(?:s|es)?\\s+of\\s+`, 'i');
const FEW = /^(?:a few|a couple of|several|few|some)\s+/i;
const STOP = new Set(['of', 'the', 'a', 'an', 'and', 'some', 'with', 'for']);
const PORTION_SET = new Set(PORTION_WORDS.split('|').flatMap(word => [word, `${word}s`, `${word}es`]));

/** A key without its portion words: "a handful of Moonpetals" → "moonpetals" (as aliasKey writes it). */
export function portionless(name) {
    let key = aliasKey(name).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    for (let n = 0; n < 2; n += 1) key = key.replace(PORTION, '').replace(FEW, '').trim();
    return key;
}

// One word made singular, the same way for the name written and the def's name.
function singular(word) {
    if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
    if (/(?:s|x|z|ch|sh|o)es$/.test(word)) return word.slice(0, -2);
    if (/[^s]s$/.test(word)) return word.slice(0, -1);
    return word;
}

const LOOSE_CACHE = new Map();
const LOOSE_CACHE_MAX = 5000;

/**
 * The word-order-insensitive key of a name: "Alloy of Sulfur (piece)" and "sulfur alloys" → "alloy sulfur".
 * Tokens with digits keep their order after the words ("Charm 1-2" → "charm #1 2"). '' when nothing is left.
 */
export function looseKey(name) {
    const text = String(name ?? '');
    const known = LOOSE_CACHE.get(text);
    if (known !== undefined) return known;
    const words = portionless(text).split(/[^\p{L}\p{N}']+/u)
        .filter(word => word && !STOP.has(word) && !PORTION_SET.has(word))
        .map(singular);
    // Only plain words change places: a token with a digit (a number, a size) keeps its order, so
    // "Charm 1-2" and "Charm 2-1" stay two names.
    const plain = words.filter(word => !/\p{N}/u.test(word)).sort();
    const counted = words.filter(word => /\p{N}/u.test(word));
    const key = counted.length ? `${plain.join(' ')} #${counted.join(' ')}` : plain.join(' ');
    if (LOOSE_CACHE.size >= LOOSE_CACHE_MAX) LOOSE_CACHE.clear();
    LOOSE_CACHE.set(text, key);
    return key;
}
