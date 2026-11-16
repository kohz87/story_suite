// Writes the static prompt's coin line and money line.

import { DEFAULT_CURRENCY } from './constants.js';
import { tidy, MAX_NAME, MAX_SHORT, coinList } from './shared-tidy.js';
import { pluralOf } from './names.js';
import { baseUnit } from './coins.js';
import { coinValue } from './value.js';

/**
 * One short worked conversion (" Sum in copper, then convert: ...") built from the chat's own coins, or '' for a
 * single-unit currency: a bare rate loses to the habit of dollars and cents, a sum shown once does not. It
 * sums in the smallest unit to a whole number of the first larger coin (18 x 2 per-coin units = 36 coins),
 * and, with a second larger coin, shows a mixed amount (one big coin, up to two small, a remainder under one
 * small coin). Every number comes from the configured values and the arithmetic is exact.
 */
function workedExample(base, larger) {
    const [small, big] = larger;
    if (!small) return '';
    const word = (count, unit) => `${count} ${count === 1 ? unit.name : unit.plural}`;
    const rate = 2 * small.value;
    let text = ` Sum in ${base.plural}, then convert: 18 × ${word(rate, base)} = ${word(18 * rate, base)} = ${word(36, small)}`;
    if (big) {
        const rest = small.value > 5 ? 5 : 1;
        let each = 2;
        while (each > 0 && (each * small.value + rest >= big.value)) each -= 1;
        if (each * small.value + rest < big.value) {
            const total = big.value + each * small.value + rest;
            text += `; ${word(total, base)} = ${word(1, big)}${each ? ` ${word(each, small)}` : ''} ${word(rest, base)}`;
        }
    }
    return `${text}.`;
}

/**
 * The static prompt's coin line (one short line), or '' for a currency without coins: the coins and
 * what each is worth in the smallest unit, and how a money line is written. It changes only when the
 * coins do.
 */
export function coinLine(currency) {
    const coins = coinList(currency);
    if (!coins.length) return '';
    const base = baseUnit(currency);
    const larger = coins.filter(coin => coin.value > 1).slice(0, 6);
    const worth = larger.map(coin => `1 ${coin.name} = ${coin.value} ${base.plural}`).join(', ');
    const example = larger[0]?.name ?? base.plural;
    return `Money is counted in ${base.plural}${worth ? `: ${worth}` : ''}.${workedExample(base, larger)} A coin line names one coin (+ coin 3 ${example}) or ${base.plural} (+ coin 35); never two coins in one line.`;
}

/**
 * The static prompt's money line (one short line): always names the chat's currency, so the narrator
 * never falls back on the lore's own coins once the reader names a different one. With coins it is
 * coinLine (the currency's name is added first when it is none of the coins); a single-unit currency says
 * its name, plural and short form (when the reader set one) and that no other coins exist, which is what
 * foreignCoin enforces on a coin line. It changes only when the currency setting does. `oneCoin`: a one-coin list worth 1 is told as a single-unit currency.
 */
export function moneyLine(currency = DEFAULT_CURRENCY, oneCoin = false) {
    const name = tidy(currency?.name, MAX_NAME) || DEFAULT_CURRENCY.name;
    const plural = tidy(currency?.plural, MAX_NAME) || pluralOf(name);
    // `oneCoin` (the chat is under the `oneCoin` rule mark): a coin list of one coin worth 1 is a single-unit currency, so it also says that no other coins exist.
    // Only when coin lines accept every word the single-unit line would name (name, plural, a shown short form): else the coin line stays (penny/pence: "pence" is refused where the coin is penny).
    const only = coinList(currency)[0];
    const short = tidy(currency?.short, MAX_SHORT);
    const ownShort = name === DEFAULT_CURRENCY.name ? DEFAULT_CURRENCY.short : Array.from(name)[0].toLowerCase();
    const told = [name, plural, ...(short && short !== ownShort ? [short] : [])];
    const asUnit = oneCoin && coinList(currency).length === 1 && only.value === 1 && told.every(word => coinValue(word, currency) > 0);
    const coins = asUnit ? [] : coinList(currency);
    if (coins.length) {
        const known = coins.some(coin => [coin.name, coin.plural].some(word => word.toLowerCase() === name.toLowerCase() || word.toLowerCase() === plural.toLowerCase()));
        return `${known ? '' : `Money in this story is the ${name}${plural.toLowerCase() === name.toLowerCase() ? '' : ` (plural: ${plural})`}. `}${coinLine(currency)}`;
    }
    const forms = [plural.toLowerCase() === name.toLowerCase() ? '' : `plural: ${plural}`, short && short !== ownShort ? `short: ${short}` : ''].filter(Boolean).join(', ');
    return `Money in this story is ${plural.toLowerCase() === name.toLowerCase() ? '' : 'the '}${name}${forms ? ` (${forms})` : ''}. Name amounts in ${plural} in narration and in coin lines (+ coin 35); no other coins exist.`;
}
