// Writes an amount or a wallet as text in the currency's words.

import { DEFAULT_CURRENCY, WALLET_KEY } from './constants.js';
import { coinList } from './shared-tidy.js';
import { pluralOf } from './names.js';
import { baseUnit } from './coins.js';

/**
 * "1 mark", "44 marks" (the plural from the currency, else pluralOf(name)). With coins: mixed, largest
 * first ("3 silver 5 pennies"; nothing: "0 pennies"), or the smallest unit ("35 pennies") with
 * `display: 'base'`.
 */
export function formatAmount(amount, currency = DEFAULT_CURRENCY) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    const coins = coinList(currency);
    if (coins.length) {
        const base = baseUnit(currency);
        if (currency?.display === 'base' || n === 0) return `${n} ${n === 1 ? base.name : base.plural}`;
        const parts = [];
        let rest = n;
        const shown = coins.filter((coin, index) => coins.findIndex(other => other.value === coin.value) === index);
        for (const coin of [...shown].reverse()) {
            const count = Math.floor(rest / coin.value);
            if (!count) continue;
            parts.push(`${count} ${count === 1 ? coin.name : coin.plural}`);
            rest -= count * coin.value;
        }
        if (rest) parts.push(`${rest} ${rest === 1 ? base.name : base.plural}`);
        return parts.join(' ');
    }
    const name = currency?.name || DEFAULT_CURRENCY.name;
    return `${n} ${n === 1 ? name : currency?.plural || pluralOf(name)}`;
}

/** One wallet ({ coin: n }) as text. */
export function formatWallet(wallet, currency = DEFAULT_CURRENCY) {
    return formatAmount(wallet?.[WALLET_KEY] ?? 0, currency);
}
