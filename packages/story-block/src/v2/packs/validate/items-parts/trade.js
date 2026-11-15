// Checking shops and recipes.

import { SLUG, DEFAULT_CRAFTS, RECIPE_LIMITS, STAT_SUM } from '../../limits.js';
import { oneLine } from '../../../../text.js';
import { isInt, isObject, openRecord } from '../core.js';

export function checkShop(record, path, add, ref) {
    const base = openRecord(record);
    if (record.stock === undefined) return { ...base, stock: [] };
    if (!Array.isArray(record.stock)) {
        add('BAD_RECORD', `${path}.stock`, `"${record.name}": stock must be a list of items.`);
        return null;
    }
    const stock = [];
    let ok = true;
    record.stock.forEach((entry, index) => {
        const at = `${path}.stock[${index}]`;
        const line = typeof entry === 'string' ? { item: entry } : entry;
        if (!isObject(line)) { ok = false; return add('BAD_RECORD', at, `"${record.name}": each stock entry is an item name or { "item": …, "qty": … }.`); }
        const id = ref(line.item);
        if (!id) { ok = false; return add('UNKNOWN_REF', `${at}.item`, `"${record.name}" sells "${line.item}", which is not an item of this pack or a def ID.`); }
        if (line.qty !== undefined && !isInt(line.qty, 1)) { ok = false; return add('BAD_RECORD', `${at}.qty`, `"${record.name}": qty must be a whole number of 1 or more.`); }
        if (line.price !== undefined && !isInt(line.price)) { ok = false; return add('BAD_RECORD', `${at}.price`, `"${record.name}": price must be a whole number of 0 or more.`); }
        stock.push({ ...line, item: id });
    });
    return ok ? { ...base, stock } : null;
}

export function checkRecipe(record, path, add, ref, craftIds) {
    const base = openRecord(record);
    let ok = true;
    const craft = checkRecipeCraft(record, path, add, craftIds);
    if (!craft) ok = false;
    const makes = ref(record.makes);
    if (!makes) { ok = false; add('UNKNOWN_REF', `${path}.makes`, `"${record.name}" makes "${record.makes ?? ''}", which is not an item of this pack or a def ID.`); }
    if (record.qty !== undefined && !isInt(record.qty, 1)) { ok = false; add('BAD_RECORD', `${path}.qty`, `"${record.name}": qty must be a whole number of 1 or more.`); }
    for (const field of ['fee', 'minutes']) {
        if (record[field] !== undefined && !isInt(record[field])) { ok = false; add('BAD_RECORD', `${path}.${field}`, `"${record.name}": ${field} must be a whole number of 0 or more.`); }
    }
    const materials = [];
    if (!Array.isArray(record.materials) || !record.materials.length) {
        ok = false;
        add('BAD_RECORD', `${path}.materials`, `"${record.name}": materials must be a list like [{ "item": "iron-ingot", "qty": 2 }].`);
    } else {
        record.materials.forEach((entry, index) => {
            const at = `${path}.materials[${index}]`;
            const id = isObject(entry) ? ref(entry.item) : null;
            if (!id) { ok = false; return add('UNKNOWN_REF', `${at}.item`, `"${record.name}" needs "${isObject(entry) ? entry.item : entry}", which is not an item of this pack or a def ID.`); }
            if (!isInt(entry.qty ?? 1, 1)) { ok = false; return add('BAD_RECORD', `${at}.qty`, `"${record.name}": qty must be a whole number of 1 or more.`); }
            materials.push({ item: id, qty: entry.qty ?? 1 });
        });
    }
    return ok ? { ...base, makes, qty: record.qty ?? 1, materials, ...craft } : null;
}

// A recipe's crafting fields (MODULES §F102), each optional and kept only when given:
// `craft` (a default craft or one of this pack's `crafts`), `dc` 5–40, `station` (a slug: forge,
// alchemy-table, campfire, inn, workbench or the pack's own), `stat` ('STR+DEX', overriding the
// craft's stats), `known` (true: every character knows it from the start) and `teaches` (who
// teaches it, as text). Returns the normalized fields, or null after saying what is wrong.
function checkRecipeCraft(record, path, add, craftIds) {
    const label = `"${record.name}"`;
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    const out = {};
    if (record.craft !== undefined) {
        if (typeof record.craft !== 'string' || !SLUG.test(record.craft)) say('craft', 'craft must be a craft id like "alchemy" (lowercase letters, digits and dashes).');
        else if (!craftIds.has(record.craft)) say('craft', `"${record.craft}" is not a craft: use ${DEFAULT_CRAFTS.map(entry => entry.craft).join(', ')}, or declare it in this pack's content.crafts.`, 'UNKNOWN_REF');
        else out.craft = record.craft;
    }
    if (record.dc !== undefined) {
        if (!Number.isInteger(record.dc) || record.dc < RECIPE_LIMITS.dcMin || record.dc > RECIPE_LIMITS.dcMax) say('dc', `dc must be a whole number from ${RECIPE_LIMITS.dcMin} to ${RECIPE_LIMITS.dcMax} (how hard the craft check is).`);
        else out.dc = record.dc;
    }
    if (record.station !== undefined) {
        if (typeof record.station !== 'string' || !SLUG.test(record.station)) say('station', 'station must be a station id like "forge", "alchemy-table", "campfire", "inn" or "workbench" (lowercase letters, digits and dashes).');
        else out.station = record.station;
    }
    if (record.stat !== undefined) {
        const stats = typeof record.stat === 'string' ? record.stat.split('+') : [];
        if (typeof record.stat !== 'string' || !STAT_SUM.test(record.stat)) say('stat', `stat must be 1 to ${RECIPE_LIMITS.stats} stat names joined by + (like "STR+DEX" or "INT").`);
        else if (new Set(stats).size !== stats.length) say('stat', `stat names "${record.stat}" with a stat twice.`);
        else out.stat = record.stat;
    }
    if (record.known !== undefined) {
        if (typeof record.known !== 'boolean') say('known', 'known must be true (every character knows it from the start) or false.');
        else out.known = record.known;
    }
    if (record.teaches !== undefined) {
        if (typeof record.teaches !== 'string' || !record.teaches.trim() || oneLine(record.teaches).length > RECIPE_LIMITS.teaches) say('teaches', `teaches must say who teaches it, 1 to ${RECIPE_LIMITS.teaches} characters (like "Hollis at the Gate Forge").`);
        else out.teaches = oneLine(record.teaches);
    }
    return ok ? out : null;
}
