// Checking markets.

import { MARKET_WORD, MARKET_LIMITS, MARKET_FIELDS } from '../../limits.js';
import { oneLine } from '../../../../../../../core/text.js';
import { isNumber, isText, isObject, isInt } from '../core.js';

// Markets (PACKS.md "Markets"): settlement types and environment tags with their price factors.
// A module can read these alongside its own defaults. Each record is a type (`type`, with `buy`, `sell`
// and `stock`) or a tag (`tag`, with `prices` per item category); one of each name per pack.
export function checkMarkets(list, packId, add) {
    if (!Array.isArray(list)) {
        add('BAD_CONTENT', 'content.markets', 'content.markets must be a list like [{ "type": "town", "buy": 1 }, { "tag": "coastal", "prices": { "fish": 0.8 } }].');
        return [];
    }
    if (list.length > MARKET_LIMITS.records) {
        add('BAD_CONTENT', 'content.markets', `content.markets holds at most ${MARKET_LIMITS.records} records.`);
        return [];
    }
    const { factorMin: lo, factorMax: hi } = MARKET_LIMITS;
    const isFactor = value => isNumber(value) && value >= lo && value <= hi;
    const out = [];
    const seen = new Set();
    let ok = true;
    list.forEach((record, index) => {
        const path = `content.markets[${index}]`;
        if (!isObject(record)) { ok = false; return add('BAD_RECORD', path, `${path} must be an object like { "type": "town", "buy": 1.1 }.`); }
        const name = record.type ?? record.tag;
        const label = typeof name === 'string' ? `Market "${name}"` : path;
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
        for (const key of Object.keys(record)) if (!MARKET_FIELDS.includes(key)) say(key, `"${key}" is not a market field (expected ${MARKET_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        const isType = record.type !== undefined;
        if (isType === (record.tag !== undefined)) say(isType ? 'tag' : 'type', 'a market record is either a settlement type ("type") or an environment tag ("tag").');
        else if (typeof name !== 'string' || !MARKET_WORD.test(name)) say(isType ? 'type' : 'tag', 'it must be a lowercase word like "village" or "coastal".');
        else if (seen.has(`${isType ? 'type' : 'tag'}:${name}`)) say(isType ? 'type' : 'tag', `"${name}" is in this list twice.`, 'DUPLICATE');
        else seen.add(`${isType ? 'type' : 'tag'}:${name}`);
        const fields = isType ? ['buy', 'sell', 'stock'] : ['prices'];
        for (const field of ['buy', 'sell', 'stock', 'prices']) if (record[field] !== undefined && !fields.includes(field)) say(field, `${field} belongs to ${isType ? 'an environment tag' : 'a settlement type'}.`);
        for (const field of ['buy', 'sell']) if (isType && record[field] !== undefined && !isFactor(record[field])) say(field, `${field} must be a factor from ${lo} to ${hi} (1 = as usual).`);
        const stock = record.stock;
        if (isType && stock !== undefined && !(Array.isArray(stock) && stock.length === 2 && stock.every(n => isInt(n, 1) && n <= MARKET_LIMITS.stock) && stock[0] <= stock[1])) say('stock', `stock must be [least, most] things a trader has, whole numbers from 1 to ${MARKET_LIMITS.stock}.`);
        const prices = record.prices;
        if (!isType && prices !== undefined) {
            if (!isObject(prices) || Object.keys(prices).length > MARKET_LIMITS.categories || Object.entries(prices).some(([key, value]) => !MARKET_WORD.test(key) || !isFactor(value))) say('prices', `prices must map item categories (like "fish" or "all") to factors from ${lo} to ${hi}, at most ${MARKET_LIMITS.categories}.`);
        }
        if (record.note !== undefined && !isText(record.note, MARKET_LIMITS.note)) say('note', `note must be text of at most ${MARKET_LIMITS.note} characters.`);
        if (!good) { ok = false; return; }
        out.push(isType
            ? { type: name, ...(record.buy !== undefined ? { buy: record.buy } : {}), ...(record.sell !== undefined ? { sell: record.sell } : {}), ...(stock ? { stock: [...stock] } : {}), ...(record.note ? { note: oneLine(record.note, MARKET_LIMITS.note) } : {}), pack: packId }
            : { tag: name, prices: { ...(prices ?? {}) }, ...(record.note ? { note: oneLine(record.note, MARKET_LIMITS.note) } : {}), pack: packId });
    });
    return ok ? out : [];
}
