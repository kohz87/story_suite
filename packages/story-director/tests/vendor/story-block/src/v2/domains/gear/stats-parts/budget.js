// Gear's stat budgets: reading a record's stats, holding them to a budget, and the points a def or pack item may give.

import { isPlainObject } from '../../common.js';
import { GEAR } from './constants.js';

/** The seven stats a record names with a positive whole number: { STR: 2 } (keys in any case; the rest is left out). */
export function statsOf(record) {
    const out = {};
    if (!isPlainObject(record)) return out;
    for (const key of Object.keys(record)) {
        const stat = String(key).trim().toUpperCase();
        if (GEAR.stats.includes(stat) && Number.isSafeInteger(record[key]) && record[key] > 0) out[stat] = (out[stat] ?? 0) + record[key];
    }
    return out;
}

/** The stats held to `budget` total points and to GEAR.maxStats different stats, in the order of GEAR.stats (`written`: in the order they were given, first one first). */
export function withinBudget(stats, budget, written = false) {
    const out = {};
    let left = Math.max(0, budget);
    for (const stat of written ? Object.keys(stats ?? {}).filter(key => GEAR.stats.includes(key)) : GEAR.stats) {
        if (Object.keys(out).length >= GEAR.maxStats) break;
        const n = Math.min(stats?.[stat] ?? 0, left);
        if (n > 0) { out[stat] = n; left -= n; }
    }
    return out;
}

/** A pack item's explicit bonus (0…6), only for a `pack.` def; else null. */
export const packBonus = (id, value) => (typeof id === 'string' && id.startsWith('pack.') && Number.isSafeInteger(value) && value >= 0 && value <= GEAR.bonusMax ? value : null);

/** The stat points a def may give while worn and whole: the pack's explicit `bonus`, else by rarity. */
export function gearBudget(def) {
    const explicit = packBonus(def?.id, def?.bonus);
    if (explicit !== null) return explicit;
    return Object.hasOwn(GEAR.budget, def?.rarity) ? GEAR.budget[def.rarity] : 0;
}
