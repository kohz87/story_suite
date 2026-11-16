// Checking a pack's currency and economy sections.

import { ECONOMY_FIELDS, ECONOMY_LIMITS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { MAX_COINS, MAX_COIN_VALUE, coinsOf } from '../../../packages/story-block/src/v2/domains/money.js';
import { isObject, isNumber, isText } from '../core.js';

// A currency the pack suggests (MODULES §F1): one name for the chat's one currency (singular, with an
// optional plural and short form), used only when the reader has not named one; optionally its coins
// (MODULES §F108): `coins: [{ name, plural?, value }]`, each worth `value` of the smallest (whole, 1 to
// 1,000,000), at most 8, names once each.
export function checkCurrency(currency, add) {
    const { short, plural, coins } = currency ?? {};
    const optional = (value, max) => value === undefined || (typeof value === 'string' && value.trim() && value.length <= max);
    if (!isObject(currency) || Object.keys(currency).some(key => !['name', 'plural', 'short', 'coins'].includes(key))
        || typeof currency.name !== 'string' || !currency.name.trim() || currency.name.length > 24
        || !optional(short, 8) || !optional(plural, 24)) {
        add('BAD_CURRENCY', 'currency', 'currency must be { "name": "mark" } (at most 24 characters), with an optional "plural" of at most 24 ("marks"), "short" of at most 8 ("m") and "coins".');
        return null;
    }
    let cleanCoins = null;
    if (coins !== undefined) {
        const good = Array.isArray(coins) && coins.length >= 1 && coins.length <= MAX_COINS && coins.every(coin => isObject(coin)
            && Object.keys(coin).every(key => ['name', 'plural', 'value'].includes(key))
            && typeof coin.name === 'string' && coin.name.trim() && coin.name.length <= 24 && !/[\d|:#<>/]/.test(coin.name)
            && optional(coin.plural, 24) && Number.isSafeInteger(coin.value) && coin.value >= 1 && coin.value <= MAX_COIN_VALUE);
        cleanCoins = good ? coinsOf(coins.map(coin => ({ name: oneLine(coin.name), value: coin.value, ...(coin.plural === undefined ? {} : { plural: oneLine(coin.plural) }) }))) : [];
        if (!good || cleanCoins.length !== coins.length) {
            add('BAD_CURRENCY', 'currency.coins', 'currency.coins must be 1 to 8 coins [{ "name": "penny", "plural": "pennies", "value": 1 }, { "name": "silver", "value": 10 }]: a name of at most 24 characters without digits, once each, and a whole value from 1 to 1,000,000 (what one is worth in the smallest).');
            cleanCoins = null;
        }
    }
    return { name: oneLine(currency.name), short: oneLine(short ?? ''), ...(plural === undefined ? {} : { plural: oneLine(plural) }), ...(cleanCoins ? { coins: cleanCoins } : {}) };
}

// A pack's money scale (MODULES §F104): `{ scale?, note? }`, `scale` a number from 0.001 to 1000
// (default 1) that multiplies the built-in money defaults; `note` says what the scale is, for the reader.
export function checkEconomy(economy, add) {
    let ok = true;
    const say = (path, message, code = 'BAD_ECONOMY') => { ok = false; add(code, path, message); };
    if (!isObject(economy)) {
        say('economy', 'economy must be { "scale": 1, "note": "…" } (both optional).');
        return null;
    }
    for (const key of Object.keys(economy)) if (!ECONOMY_FIELDS.includes(key)) say(`economy.${key}`, `"${key}" is not an economy field (expected ${ECONOMY_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const scale = economy.scale === undefined ? 1 : economy.scale;
    if (!isNumber(scale) || scale < ECONOMY_LIMITS.min || scale > ECONOMY_LIMITS.max) say('economy.scale', `economy.scale must be a number from ${ECONOMY_LIMITS.min} to ${ECONOMY_LIMITS.max}: how many of this pack's coins the built-in defaults' one is worth (1 leaves them as they are, 0.01 for a world a hundred times poorer).`);
    const note = economy.note ?? '';
    if (!isText(note, ECONOMY_LIMITS.note)) say('economy.note', `economy.note must be text of at most ${ECONOMY_LIMITS.note} characters.`);
    return ok ? { scale, note: note.trim() } : null;
}
