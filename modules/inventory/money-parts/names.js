// Forms the plural of a currency name or a coin name.

import { DEFAULT_CURRENCY } from './constants.js';
import { tidy, MAX_NAME } from './shared-tidy.js';

// Coin names that read as their own plural ("15 copper", "3 silver").
export const MASS_WORDS = new Set(['copper', 'silver', 'gold', 'bronze', 'iron', 'brass', 'tin', 'steel', 'platinum', 'electrum', 'nickel']);

/**
 * The plural a currency name gets when none is set: the name + "s" ("marks"). Gold stays gold, and a
 * name the reader already wrote as a plural ("crowns") is not given a second s.
 */
export function pluralOf(name) {
    const singular = tidy(name, MAX_NAME) || DEFAULT_CURRENCY.name;
    if (singular.toLowerCase() === DEFAULT_CURRENCY.name || /s$/i.test(singular)) return singular;
    return `${singular}s`;
}

/** The plural a coin gets when none is written: a metal reads as its own ("15 copper"), "penny" → "pennies", "crown" → "crowns". */
export function coinPlural(name) {
    const singular = tidy(name, MAX_NAME);
    const lower = singular.toLowerCase();
    if (!singular || MASS_WORDS.has(lower) || /s$/i.test(singular)) return singular;
    if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`;
    if (/(?:x|z|ch|sh)$/i.test(singular)) return `${singular}es`;
    return `${singular}s`;
}
