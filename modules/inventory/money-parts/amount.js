// Reads an amount of money from a coin line or a reader's purse input into the smallest unit.

import { STRINGS, fill } from '../../../core/strings.js';
import { DEFAULT_CURRENCY } from './constants.js';
import { tidy, coinList } from './shared-tidy.js';
import { baseUnit } from './coins.js';
import { coinValue } from './value.js';
import { foreignCoin } from './foreign.js';

const E = STRINGS.editMessages;

/**
 * An amount from a coin line: the number, in the smallest unit ("30", "30 gold", "1,200 crowns"; a
 * currency without coins reads the number, and refuses a coin word that is not its own, foreignCoin:
 * "40 silver" where money is pennies is never 40 pennies). With coins, a known coin's name multiplies it ("3 silver"
 * → 30 when silver is worth 10) and any other word is refused, so no amount is read in the wrong coin.
 * { amount } or { error } with a plain sentence. Several numbers are added up only when each names a known coin
 * ("3 silver 6 copper" → 36); otherwise they are refused, not guessed.
 */
export function parseAmount(text, currency = null) {
    const { multiple = false, ...read } = parseNumber(text);
    const coined = coinList(currency).length > 0;
    if (!coined) {
        // "40 silver" where the money is pennies: a coin this chat does not know is refused (MODULES §F122).
        // Without a currency (a caller that does not know the chat's money) only the number is read, as before.
        const foreign = read.error || !currency ? '' : foreignCoin(String(text ?? '').replace(/\d[\d,.]*/g, ' '), currency);
        if (foreign) return { error: `"${foreign}" is not this chat's money: it counts in ${baseUnit(currency).plural}. Write the amount in ${baseUnit(currency).plural}, or name the coins under Settings → Coins.` };
        return read;
    }
    // "3 silver 5 copper" (also with "," or "and" between): each number named by a known coin is added up, as the
    // reader's own purse input is (parseMixedAmount). Two numbers without a known coin each ("30 5") are refused.
    if (read.error && multiple) {
        const mixed = coinsAdded(text, currency);
        if (mixed) return { amount: mixed };
        return { error: `${read.error.replace(/; write one amount\.$/, '')}: write it in one coin or in ${baseUnit(currency).plural} (+ coin 35).` };
    }
    if (read.error) return read;
    const words = String(text ?? '').replace(/\d[\d,.]*/g, ' ').replace(/[^\p{L}\s'-]+/gu, ' ');
    if (!words.trim()) return read;
    const value = coinValue(words, currency);
    if (!value) return { error: `"${tidy(words, 40)}" is not a coin here: write ${coinList(currency).map(coin => coin.name).join(', ')} or a number of ${baseUnit(currency).plural}.` };
    const amount = read.amount * value;
    if (!Number.isSafeInteger(amount)) return { error: 'That amount is too large.' };
    return { amount };
}

// "3 silver 6 copper", "3 silver, 6 copper", "3 silver and 6 copper": the sum in the smallest unit when every number is
// followed by a known coin and nothing else is there, else 0. (No call back into parseAmount: it is its fallback.)
function coinsAdded(text, currency) {
    const input = String(text ?? '').replace(/\s*(?:,(?!\d{3})|;|&|\+|\band\b)\s*/giu, ' ').replace(/\s+/g, ' ').trim();
    const parts = [...input.matchAll(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d+)\s+([^\d]+?)(?=\s+\d|$)/gu)];
    if (parts.length < 2 || parts.map(part => part[0]).join('').trim() !== input) return 0;
    let amount = 0;
    for (const part of parts) {
        const worth = coinValue(part[2], currency);
        const count = Number(part[1].replace(/,/g, ''));
        if (!worth || !(count > 0)) return 0;
        amount += count * worth;
        if (!Number.isSafeInteger(amount)) return 0;
    }
    return amount;
}

/** A reader's purse input: one amount or several named coins, summed in the smallest unit. */
export function parseMixedAmount(text, currency = DEFAULT_CURRENCY) {
    const input = String(text ?? '').trim();
    if (!input) return { error: E.moneyEmpty };
    if (/^0+$/.test(input)) return { amount: 0 };
    const zero = /^0+\s+(.+)$/.exec(input);
    if (zero && coinValue(zero[1], currency)) return { amount: 0 };
    if (!coinList(currency).length) return parseAmount(input, currency);
    if (/[^\p{L}\s0-9,'-]/u.test(input) || /[-']\s*\d/.test(input)) return { error: E.moneyWhole };
    const parts = [...input.matchAll(/(?:^|\s)(\d[\d,]*)(?:\s+)([^\d]+?)(?=\s+\d|$)/gu)];
    if (!parts.length) return parseAmount(input, currency);
    if (parts.map(part => part[0]).join('').trim() !== input) return { error: E.moneyWhole };
    let amount = 0;
    for (const part of parts) {
        if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(part[1])) return { error: E.moneyWhole };
        const count = Number(part[1].replace(/,/g, ''));
        const worth = coinValue(part[2], currency);
        if (!worth) return { error: fill(E.moneyUnknown, { name: tidy(part[2], 40) }) };
        if (!Number.isSafeInteger(count) || !Number.isSafeInteger(count * worth) || !Number.isSafeInteger(amount + count * worth)) return { error: E.moneyLarge };
        amount += count * worth;
    }
    return { amount };
}

// The number of an amount (parseAmount without coins): only plain whole digits, one number, no sign.
function parseNumber(text) {
    const numbers = String(text ?? '').match(/\d[\d,.]*/g) ?? [];
    if (!numbers.length) return { error: 'No amount of money was written.' };
    // The line's op is the only sign: "+ coin -50" is not a payment of 50 (B3-5). Any dash or minus
    // counts (C2-4: ‐ ‑ ‒ ⁻ ₋ ﹣ － as well as - − – —).
    if (/[\p{Pd}\u2212\u207B\u208B]\s*\d/u.test(String(text))) return { error: 'Write the amount without a sign; + coin or - coin says whether it is gained or paid.' };
    // C2-4: only plain digits make an amount; a fraction, a superscript, other digits or a decimal
    // point in front (".5", "٫5", "2⁵", "½5") would be paid as a different whole number.
    if (/[^\P{N}0-9]/u.test(String(text)) || /(?:^|[^\d])[.,\u066B\u066C]\d/.test(String(text))) return { error: `"${String(text).trim()}" is not a whole amount.` };
    if (numbers.length > 1) return { error: `"${String(text).trim()}" holds more than one number; write one amount.`, multiple: true };
    const written = numbers[0].replace(/[.,]$/, '');
    if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(written)) return { error: `"${written}" is not a whole amount.` };
    const amount = Number(written.replace(/,/g, ''));
    if (!Number.isSafeInteger(amount) || amount <= 0) return { error: 'The amount must be more than nothing.' };
    return { amount };
}
