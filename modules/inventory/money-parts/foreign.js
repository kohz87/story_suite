// Finds a coin word in a text that is not this chat's money.

import { DEFAULT_CURRENCY } from './constants.js';
import { tidy, MAX_NAME, coinList } from './shared-tidy.js';
import { pluralOf, MASS_WORDS } from './names.js';

// Words that name a coin of some world (MODULES §F122): in a chat without coins, an amount in one of them
// that is not the chat's own currency ("40 silver" where money is pennies) names a coin this chat does not
// know, so it is refused, never read as that many of the chat's money.
const DENOMINATIONS = new Set([...MASS_WORDS, 'cp', 'sp', 'gp', 'pp', 'ep', 'crown', 'crowns', 'mark', 'marks', 'penny',
    'pennies', 'pence', 'shilling', 'shillings', 'ducat', 'ducats', 'florin', 'florins', 'sovereign', 'sovereigns',
    'denar', 'denars', 'denarii', 'groat', 'groats', 'farthing', 'farthings', 'guinea', 'guineas', 'noble', 'nobles', 'gil']);

// "gp" is gold pieces in a gold chat (and so on): the metal's own short form.
const PIECES = Object.freeze({ gold: 'gp', silver: 'sp', copper: 'cp', platinum: 'pp', electrum: 'ep' });

/**
 * The coin word in `text` that is not this chat's money, or '': only for a currency without coins (with
 * coins, coinValue already refuses every word that is not one of them). The currency's own name, plural and
 * short form, and a bare "coin", are its money; any other word of DENOMINATIONS ("silver" where money is
 * pennies) names a coin the chat does not know (MODULES §F122).
 */
export function foreignCoin(text, currency = DEFAULT_CURRENCY) {
    if (coinList(currency).length) return '';
    const name = tidy(currency?.name, MAX_NAME).toLowerCase() || DEFAULT_CURRENCY.name;
    const own = new Set([name, `${name}s`, String(currency?.plural || pluralOf(name)).toLowerCase(), String(currency?.short ?? '').toLowerCase(), PIECES[name]].filter(Boolean));
    const words = String(text ?? '').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
    if (words.some(word => own.has(word))) return '';
    return words.find(word => DENOMINATIONS.has(word)) ?? '';
}
