// Pack items as inventory defs: all of them, and the one a story name means.

import { slugify } from '../validate/core.js';
import { foldKey } from '../../core/text.js';
import { copy } from './shared-copy.js';

// The inventory def fields (SPEC §7), in a fixed order.
const DEF_FIELDS = ['id', 'name', 'kind', 'rarity', 'value', 'stack', 'slot', 'stats', 'effect', 'tags', 'note'];

/**
 * The item as an inventory def (SPEC §7): `{ id: 'pack.<id>/<slug>', name, kind, … }`, with its `carry`
 * (the carry capacity it adds, PACKS.md "Carry capacity") when it has one.
 */
export function itemDef(item) {
    const def = {};
    for (const field of DEF_FIELDS) def[field] = copy(item[field]);
    if (Number.isSafeInteger(item.carry) && item.carry > 0) def.carry = item.carry;
    if (Number.isSafeInteger(item.bonus) && item.bonus >= 0) def.bonus = item.bonus;
    if (Number.isSafeInteger(item.soak) && item.soak >= 0) def.soak = item.soak;
    return def;
}

/**
 * The enabled packs' items as inventory defs by definition ID: `[def…]`, ID-sorted, each ID once (the first
 * pack that has it wins, as for names). `ids` narrows to those full IDs (`pack.<id>/<slug>`; unknown ones
 * are left out). A rules module freezes these into the chat (inventory.registerDefinition), after which the
 * chat's own copy answers `inventory.definitions` whether or not the pack is still installed; this is the
 * lookup that reads them while it is. Fresh copies.
 */
export function itemDefsIn(packs, ids = null) {
    const wanted = Array.isArray(ids) ? new Set(ids.filter(id => typeof id === 'string')) : null;
    const found = new Map();
    for (const pack of packs) {
        for (const item of pack.content.items) {
            if (found.has(item.id) || (wanted && !wanted.has(item.id))) continue;
            found.set(item.id, itemDef(item));
        }
    }
    return [...found.keys()].sort().map(id => found.get(id));
}

/**
 * The pack item a story name means, as an inventory def, or null.
 *
 * Precedence: a full def ID (`pack.fantasy/iron-sword`) names that item; else the first
 * enabled pack whose item has that name or alias (case and width folded); else the first
 * whose item slug equals the name's slug ("Iron-Sword!" → `iron-sword`). Inventory checks
 * its own aliases first and creates a `story/<slug>` def only when this returns null.
 */
export function resolveItemIn(packs, name) {
    const text = String(name ?? '').trim();
    if (!text) return null;
    if (text.startsWith('pack.') && text.includes('/')) {
        for (const pack of packs) for (const item of pack.content.items) if (item.id === text) return itemDef(item);
        return null;
    }
    const key = foldKey(text);
    for (const pack of packs) {
        for (const item of pack.content.items) if (foldKey(item.name) === key || item.aliases.some(alias => foldKey(alias) === key)) return itemDef(item);
    }
    const slug = slugify(text);
    if (!slug) return null;
    for (const pack of packs) for (const item of pack.content.items) if (item.slug === slug) return itemDef(item);
    return null;
}
