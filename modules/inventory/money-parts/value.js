// Reads what a money word is worth in the smallest unit and whether a text names money.

import { DEFAULT_CURRENCY } from './constants.js';
import { tidy, coinList } from './shared-tidy.js';
import { pluralOf } from './names.js';

// Words that sometimes follow a coin's name in an amount and say nothing more ("3 silver coins",
// "3 pieces of silver").
const COIN_FILLER = new Set(['coin', 'coins', 'piece', 'pieces', 'of', 'in']);

// The money words that name the smallest unit on their own (coinValue).
const BARE_COIN = new Set(['coin', 'coins']);

/**
 * What one of the money word `text` is worth in the smallest unit: a coin's value for a coin's name or
 * plural (any case, "coins"/"pieces of" around it ignored, "<name>s" too), else 1 for the currency's name
 * or plural or a bare "coin"/"coins" (the smallest unit), else 0. With coins the currency's own name is
 * not a coin (B-a1-8: "+ coin 2 gold" in a world of copper and silver is refused, never read as 2
 * copper), unless no coin is worth 1 (it is the unit).
 */
export function coinValue(text, currency = DEFAULT_CURRENCY) {
    const all = tidy(text, 200).toLowerCase().split(' ').filter(Boolean);
    const word = all.filter(word => !COIN_FILLER.has(word)).join(' ');
    // FB-3: "coin" or "coins" alone ("+ item Coins | qty: 5", "+ coin 5 coins") is the smallest unit, as
    // "+ coin 5" is; filler words alone ("pieces") are not money.
    if (!word) return all.some(word => BARE_COIN.has(word)) ? 1 : 0;
    const coins = coinList(currency);
    const coin = coins.find(entry => entry.name.toLowerCase() === word || entry.plural.toLowerCase() === word || `${entry.name.toLowerCase()}s` === word);
    if (coin) return coin.value;
    if (coins.some(entry => entry.value === 1)) return 0;
    const plural = currency?.plural || pluralOf(currency?.name);
    const name = String(currency?.name ?? '').toLowerCase();
    return word === name || word === `${name}s` || word === String(plural).toLowerCase() ? 1 : 0;
}

/**
 * True when `text` names money: the currency's name or plural, or a coin's, read as coinValue reads it
 * ("Silver Coins", "Silvers", "pieces of gold"), so an item line, a loot line and a coin line agree on
 * what is money (B-a1-7): "+ item Marks" is money.
 */
export function isCurrencyName(text, currency = DEFAULT_CURRENCY) {
    return coinValue(text, currency) > 0;
}

/** "3 silver coins" → { count: 3, value: 10 } when the words after the number name money (coinValue), else null. */
export function countedMoney(text, currency = DEFAULT_CURRENCY) {
    const found = /^(\d{1,3}(?:,\d{3})+|\d+)\s+(.+)$/.exec(tidy(text, 200));
    if (!found) return null;
    const value = coinValue(found[2], currency);
    const count = Number(found[1].replace(/,/g, ''));
    return value > 0 && Number.isSafeInteger(count) && count > 0 ? { count, value } : null;
}
