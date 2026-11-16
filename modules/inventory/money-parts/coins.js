// Cleans a list of coins, builds the currency from settings, and names its smallest unit.

import { cutAt } from '../../../core/text.js';
import { DEFAULT_CURRENCY, MAX_COINS, MAX_COIN_VALUE } from './constants.js';
import { tidy, MAX_NAME, MAX_SHORT, coinList } from './shared-tidy.js';
import { pluralOf, coinPlural } from './names.js';

/**
 * A list of coins (the Coins setting's rows `{ name, value }`, a row's name may be "penny/pennies", or a
 * pack's `{ name, plural?, value }`) cleaned: `[{ name, plural, value }]`, smallest first, at most
 * MAX_COINS, names once each (ignoring case); [] when none is usable. Two coins may be worth the same
 * ("copper" and "bronze"): both are read, the first is the one shown.
 */
export function coinsOf(rows) {
    const out = [];
    const taken = word => out.some(coin => [coin.name, coin.plural].some(other => other.toLowerCase() === word.toLowerCase()));
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!row || typeof row !== 'object' || out.length >= MAX_COINS) continue;
        const [first, second] = String(row.name ?? '').split('/');
        const name = tidy(first, MAX_NAME).replace(/[|:#<>]/g, '').trim();
        const plural = tidy(row.plural ?? second ?? '', MAX_NAME).replace(/[|:#<>]/g, '').trim() || coinPlural(name);
        const value = Number(row.value);
        if (!name || /\d/.test(name) || !Number.isSafeInteger(value) || value < 1 || value > MAX_COIN_VALUE || taken(name) || taken(plural)) continue;
        out.push({ name, plural, value });
    }
    return out.sort((a, b) => a.value - b.value);
}

/**
 * The currency from this module's settings ({ currency?, currencyPlural?, currencyShort?, coins?,
 * coinDisplay? }): { name, plural, short }, with `coins` (coinsOf) when it has any and `display: 'base'`
 * when the reader shows amounts in the smallest unit. The plural defaults to pluralOf(name); the short
 * form to the name's first letter, lowercased.
 */
export function currencyOf(settings) {
    const name = tidy(settings?.currency, MAX_NAME) || DEFAULT_CURRENCY.name;
    const plural = tidy(settings?.currencyPlural, MAX_NAME) || pluralOf(name);
    const short = cutAt(String(settings?.currencyShort ?? '').trim(), MAX_SHORT)
        || (name === DEFAULT_CURRENCY.name ? DEFAULT_CURRENCY.short : Array.from(name)[0].toLowerCase());
    const coins = coinsOf(settings?.coins);
    if (!coins.length) return { name, plural, short };
    return { name, plural, short, coins, ...(settings?.coinDisplay === 'base' ? { display: 'base' } : {}) };
}

/** The currency selected by the reader or supplied by a pack. */
export const resolveCurrency = settings => currencyOf(settings);

/** The smallest unit's names: the coin worth 1, else the currency's own name. */
export function baseUnit(currency = DEFAULT_CURRENCY) {
    const one = coinList(currency).find(coin => coin.value === 1);
    if (one) return { name: one.name, plural: one.plural };
    const name = currency?.name || DEFAULT_CURRENCY.name;
    return { name, plural: currency?.plural || pluralOf(name) };
}
