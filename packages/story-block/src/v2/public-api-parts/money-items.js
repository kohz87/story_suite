// Reads the money and items sections of the public paths.

import { formatAmount } from '../domains/money.js';
import { isObject, text, fold } from './shared-basics.js';
import { put } from './shared-put.js';

export function moneySection(ask, state) {
    const map = new Map();
    if (!isObject(state?.domains?.inventory)) return map;
    const wallet = ask('inventory.wallet', { owner: 'party' });
    const coin = Number.isSafeInteger(wallet?.coin) ? wallet.coin : 0;
    put(map, 'money', coin);
    const currency = ask('inventory.currency', {});
    put(map, 'money.text', formatAmount(coin, currency ?? undefined));
    return map;
}

export function itemsSection(ask, state) {
    const map = new Map();
    if (!isObject(state?.domains?.inventory)) return map;
    const rows = ask('inventory.items', { owner: 'party' });
    if (!Array.isArray(rows)) return map;
    // One entry per name: the stacks of a name add up (a name is one thing to a reader).
    const byName = new Map();
    for (const row of rows) {
        const name = text(row?.name);
        if (!name || !Number.isSafeInteger(row.qty)) continue;
        const key = fold(name);
        const entry = byName.get(key) ?? { name, qty: 0, kind: text(row.kind), note: '' };
        entry.qty += row.qty;
        if (!entry.note) entry.note = text(row.note);
        byName.set(key, entry);
    }
    const list = [...byName.values()];
    put(map, 'items', list.map(item => ({ name: item.name, qty: item.qty, kind: item.kind, note: item.note })), false);
    for (const item of list) {
        put(map, `items.${item.name}`, { name: item.name, qty: item.qty, kind: item.kind, note: item.note }, false);
        put(map, `items.${item.name}.qty`, item.qty);
        put(map, `items.${item.name}.kind`, item.kind || undefined);
        put(map, `items.${item.name}.note`, item.note || undefined);
    }
    return map;
}
