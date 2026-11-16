// Turns the inventory's rows into the items a character file keeps.

import { FILE_LIMITS } from './limits.js';
import { readItem } from './read-entries.js';

/**
 * The things a character carries as the file keeps them, from the inventory's rows (`inventory.items`): one entry for each
 * name, note, kind and rarity (counts added up), the first `FILE_LIMITS.items`. Rows the file cannot hold are left out.
 */
export function itemsForFile(rows) {
    const out = [], at = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const item = readItem({ name: row?.name, qty: row?.qty, note: row?.note, kind: row?.kind, rarity: row?.rarity, ...(row?.hand === true ? { slot: row?.slot, stats: row?.stats } : {}), carry: row?.readerCarry });
        if (!item) continue;
        const key = JSON.stringify([item.name.toLowerCase(), item.note ?? '', item.kind ?? '', item.rarity ?? '', item.slot ?? '', item.stats ?? null, item.carry ?? 0]);
        if (at.has(key)) {
            const had = out[at.get(key)];
            had.qty = Math.min(FILE_LIMITS.qty, had.qty + item.qty);
        } else if (out.length < FILE_LIMITS.items) {
            at.set(key, out.length);
            out.push(item);
        }
    }
    return out;
}
