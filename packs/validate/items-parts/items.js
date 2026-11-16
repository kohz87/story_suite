// Checking item records and resolving item references.

import { ITEM_FIELDS, ITEM_KINDS, RARITIES, RECORD_LIMITS, LIMITS, ITEM_CARRY, ITEM_BONUS, ITEM_SOAK, DEF_ID } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isInt, isObject } from '../core.js';

export function checkItem(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!ITEM_FIELDS.includes(key)) say(key, `"${key}" is not an item field (expected ${ITEM_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const kind = record.kind ?? 'goods';
    if (!ITEM_KINDS.includes(kind)) say('kind', `kind must be one of ${ITEM_KINDS.join(', ')}.`);
    const rarity = record.rarity ?? 'common';
    if (!RARITIES.includes(rarity)) say('rarity', `rarity must be one of ${RARITIES.join(', ')}.`);
    const value = record.value ?? 0;
    if (!isInt(value)) say('value', 'value must be a whole number of 0 or more (of the chat\'s currency).');
    // Equipment never stacks: each piece is its own stack (MODULES §F.6).
    const stack = record.stack ?? kind !== 'equipment';
    if (typeof stack !== 'boolean') say('stack', 'stack must be true or false.');
    else if (stack && kind === 'equipment') say('stack', 'equipment does not stack; leave "stack" out.');
    const slot = record.slot ?? null;
    if (slot !== null && (typeof slot !== 'string' || !slot.trim() || slot.length > RECORD_LIMITS.word)) say('slot', 'slot must be a short name like "weapon", or null.');
    const stats = record.stats ?? {};
    if (!isObject(stats) || Object.values(stats).some(n => !Number.isInteger(n))) say('stats', 'stats must map names to whole numbers: { "STR": 2 }.');
    const effect = record.effect ?? {};
    if (!isObject(effect)) say('effect', 'effect must be an object, like { "heal": 20 }.');
    const tags = record.tags ?? [];
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > RECORD_LIMITS.word)) say('tags', 'tags must be a list of short words.');
    const aliases = record.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.length > LIMITS.name)) say('aliases', 'aliases must be a list of other names for the item.');
    const note = record.note ?? '';
    if (typeof note !== 'string' || note.length > RECORD_LIMITS.note) say('note', 'note must be text of at most 500 characters.');
    // The carry capacity it adds while owned (worn, for equipment): PACKS.md "Carry capacity".
    if (record.carry !== undefined && !(isInt(record.carry, ITEM_CARRY.min) && record.carry <= ITEM_CARRY.max)) say('carry', `carry must be a whole number from ${ITEM_CARRY.min} to ${ITEM_CARRY.max} (the carry capacity it adds), or left out.`);
    // The gear bonus it gives while worn instead of its rarity's: 0 to 6 (`story-block.gear`).
    if (record.bonus !== undefined && !(isInt(record.bonus, ITEM_BONUS.min) && record.bonus <= ITEM_BONUS.max)) say('bonus', `bonus must be a whole number from ${ITEM_BONUS.min} to ${ITEM_BONUS.max} (the gear bonus it gives while worn), or left out.`);
    // The soak it gives while worn: 0 to 2 (`story-block.gear`; the slot's cap holds it further).
    if (record.soak !== undefined && !(isInt(record.soak, ITEM_SOAK.min) && record.soak <= ITEM_SOAK.max)) say('soak', `soak must be a whole number from ${ITEM_SOAK.min} to ${ITEM_SOAK.max} (the soak it gives while worn), or left out.`);
    if (!ok) return null;
    return {
        name: oneLine(record.name, LIMITS.name), kind, rarity, value, stack,
        slot: slot === null ? null : slot.trim(), stats: { ...stats }, effect: { ...effect },
        tags: tags.map(tag => tag.trim()), note,
        aliases: [...new Set(aliases.map(alias => oneLine(alias, LIMITS.name)))],
        ...(record.carry !== undefined ? { carry: record.carry } : {}),
        ...(record.bonus !== undefined ? { bonus: record.bonus } : {}),
        ...(record.soak !== undefined ? { soak: record.soak } : {}),
    };
}

// How a reference to an item is written inside a pack: an item's slug or name from this
// pack, or a full def ID (`story/rope`, `pack.other/iron-sword`). Returns the full ID or null.
export function itemRefs(items, packId) {
    const bySlug = new Map(items.map(item => [item.slug, item.id]));
    const byName = new Map();
    for (const item of items) for (const name of [item.name, ...item.aliases]) if (!byName.has(foldKey(name))) byName.set(foldKey(name), item.id);
    return value => {
        if (typeof value !== 'string' || !value.trim()) return null;
        if (value.includes('/')) return DEF_ID.test(value) ? value : null;
        return bySlug.get(value) ?? byName.get(foldKey(value)) ?? null;
    };
}
