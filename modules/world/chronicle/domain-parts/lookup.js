// Chronicle's revision read, fresh ids and the lookup of an entry by id or name.

import { isInt, isRecord } from './shared-basics.js';
import { keyOf } from './names.js';

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** The revision this command commits as (MODULES §F2 `ctx.rev`), 0 when the host does not say. */
export const revOf = ctx => (isInt(ctx?.rev) ? ctx.rev : 0);

/** A fresh `<prefix>_xxxxxxxx` id: the host's `ctx.id` (seeded), else from `ctx.rng()`; never one in `taken`. */
export function newId(ctx, prefix, taken) {
    for (let tries = 0; tries < 64; tries += 1) {
        let id = typeof ctx?.id === 'function' ? ctx.id(prefix) : '';
        if (!new RegExp(`^${prefix}_[0-9a-z]{8}$`).test(id ?? '')) {
            id = `${prefix}_`;
            for (let i = 0; i < 8; i += 1) id += ID_CHARS[Math.floor(ctx.rng() * ID_CHARS.length) % ID_CHARS.length];
        }
        if (!Object.hasOwn(taken, id)) return id;
    }
    throw new Error(`No free ${prefix} id.`);
}

/** The entry of `table` (events or factions) that `ref` names: its id, its name or a name it had. */
export function findIn(table, ref) {
    if (!isRecord(table) || ref === null || ref === undefined) return null;
    const text = String(ref);
    if (Object.hasOwn(table, text)) return table[text];
    const key = keyOf(text);
    if (!key) return null;
    const entries = Object.values(table);
    return entries.find(entry => keyOf(entry?.name) === key) ?? entries.find(entry => (entry?.aka ?? []).some(name => keyOf(name) === key)) ?? null;
}
