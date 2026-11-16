// The Money page's schema: the General fields regrouped into cards and the check on the coins.

import { MAX_COINS, MAX_COIN_VALUE, coinsOf } from '../../../domains/money.js';
import { cutAt } from '../../../../text.js';
import { SETTINGS_TEXT, groupFields } from '../../form/schema.js';
import { MONEY_CARDS } from './names.js';

const MORE = 'More';

const num = n => Number(n).toLocaleString('en-US');

/**
 * What the coins' rows hold that the story will not use, in plain words (at most `limit` sentences): a row with no name, a
 * number in a name, a worth that is not a whole number from 1 to the most, a name an earlier coin already has, and coins
 * past the most a world has. The store keeps the rows as typed; money.js `coinsOf` reads the usable ones.
 */
export function coinProblems(rows, limit = 2) {
    const list = Array.isArray(rows) ? rows : [];
    const out = [];
    const usable = [];
    let past = false;
    list.forEach((row, at) => {
        const who = `Coin ${at + 1}`;
        const name = cutAt(String(row?.name ?? '').split('/')[0].replace(/\s+/g, ' ').trim(), 24);
        const value = Number(row?.value);
        if (!name) out.push(`${who} has no name, so it is not used.`);
        else if (/\d/.test(name)) out.push(`${who} (${name}) has a number in its name, so it is not used.`);
        else if (!Number.isSafeInteger(value) || value < 1 || value > MAX_COIN_VALUE) out.push(`${who} (${name}) needs a worth from 1 to ${num(MAX_COIN_VALUE)}, so it is not used.`);
        else if (usable.length >= MAX_COINS) past = true;
        else if (coinsOf([...usable, row]).length === usable.length) out.push(`${who} (${name}) is named like an earlier coin, so it is not used.`);
        else usable.push(row);
    });
    if (past) out.push(`Only ${MAX_COINS} coins count; the rest are not used.`);
    return out.slice(0, limit);
}

/**
 * The page's schema from Story Block's own: its General group's fields regrouped into MONEY_CARDS (a field the cards do not
 * name goes in a card at the end), the coins as rows, the coins checked. → { key: field }.
 */
export function moneySchema(schema) {
    const general = groupFields(schema ?? {}).find(group => group.name === SETTINGS_TEXT.general)?.fields ?? [];
    const fields = new Map(general.map(({ key, field }) => [key, field]));
    const out = {};
    const put = (key, card) => {
        const field = fields.get(key);
        if (!field) return;
        out[key] = { ...field, group: card };
        fields.delete(key);
    };
    for (const card of MONEY_CARDS) for (const key of card.keys) put(key, card.title);
    for (const key of [...fields.keys()]) put(key, MORE);
    // The coins as name and worth rows (the text form is one tap away); what the store cannot say about them.
    if (out.coins) {
        const { form, ...rest } = out.coins;
        out.coins = { ...rest, check: rows => coinProblems(rows).join(' ') };
    }
    return out;
}
