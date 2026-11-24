// What a Text RPG character's saved file carries besides its sheet: the things in the bag and the purse, in the shape of the RPG's character file (name, qty, note, kind, rarity; a worn piece keeps its slot and bonus), read through the host's queries (`inventory.items`, `inventory.wallet`). Adapted from modules/rpg/charfile-parts/items.js (keep the limits and the dedupe key in step).
import { FILE_LIMITS } from '../wizard/charfile.js';
import { ask } from './gear.js';

const line = (text, max) => [...String(text ?? '').replace(/\p{Cf}+/gu, '').normalize('NFC').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
const whole = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;

function entryOf(row) {
    const name = line(row?.name, FILE_LIMITS.itemName);
    if (!name || !whole(row?.qty, 1, FILE_LIMITS.qty)) return null;
    const note = line(row.note, FILE_LIMITS.itemNote), kind = line(row.kind, 20), rarity = line(row.rarity, 20);
    const worn = row.hand === true, slot = worn ? line(row.slot, 20) : '';
    const given = worn && row.stats && typeof row.stats === 'object' ? Object.entries(row.stats) : [];
    const stats = given.length && given.length <= 4 && given.every(([stat, value]) => /^[a-z]{2,10}$/.test(stat) && whole(value, 1, 6)) ? Object.fromEntries(given) : null;
    const carry = whole(row.readerCarry, 1, FILE_LIMITS.carry) ? row.readerCarry : 0;
    return { name, qty: row.qty, ...(note ? { note } : {}), ...(kind ? { kind } : {}), ...(rarity ? { rarity } : {}), ...(slot ? { slot } : {}), ...(stats ? { stats } : {}), ...(carry ? { carry } : {}) };
}

/** The inventory's rows → the file's items: one entry for each name, note, kind and rarity (counts added up), the first `FILE_LIMITS.items`. */
export function itemsOfRows(rows) {
    const out = [], at = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const item = entryOf(row);
        if (!item) continue;
        const key = JSON.stringify([item.name.toLowerCase(), item.note ?? '', item.kind ?? '', item.rarity ?? '', item.slot ?? '', item.stats ?? null, item.carry ?? 0]);
        if (at.has(key)) out[at.get(key)].qty = Math.min(FILE_LIMITS.qty, out[at.get(key)].qty + item.qty);
        else if (out.length < FILE_LIMITS.items) { at.set(key, out.length); out.push(item); }
    }
    return out;
}

/** `query(name, args)` is the host's read. → { items, money } of a member: the reader's character has the party's bag and the purse, anyone else the things under their own id (no purse). */
export function thingsOf(query, member) {
    const owners = member?.pc ? ['party', member.id] : [member?.id];
    const rows = owners.flatMap(owner => { const answer = ask(query, 'inventory.items', { owner }); return Array.isArray(answer) ? answer : []; });
    const purse = member?.pc ? ask(query, 'inventory.wallet', { owner: 'party' })?.coin : null;
    return { items: itemsOfRows(rows), money: Number.isSafeInteger(purse) && purse > 0 ? Math.min(purse, FILE_LIMITS.money) : 0 };
}
