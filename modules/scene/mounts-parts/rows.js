// Reads the mount rows, the party's pace and the narrator's mounts line from the state.

import { foldKey } from '../../../core/text.js';
import { travelsWith } from '../../inventory/gear/carry-parts/mount-travel.js';
import { isPlainObject } from '../domains/common.js';
import { DEFAULT_PACE, WALK_PACE } from './pace.js';
import { ridersOf } from './riders.js';

/** The rows as copies in story order: [{ name, kind, count, pace, condition, where }]. */
export function mountRows(state) {
    const mounts = state?.domains?.scene?.mounts;
    if (!isPlainObject(mounts)) return [];
    return Object.values(mounts).filter(isPlainObject).map(row => ({
        name: String(row.name ?? ''), kind: String(row.kind ?? ''), count: Number.isSafeInteger(row.count) ? row.count : 1,
        pace: Number.isSafeInteger(row.pace) ? row.pace : DEFAULT_PACE, condition: String(row.condition ?? ''), where: String(row.where ?? ''),
        ...(Number.isSafeInteger(row.carry) && row.carry > 0 ? { carry: row.carry } : {}),
    }));
}

/**
 * `{ pace, mounts, riders, short, slowest }` or null with no mount. `pace`: the slowest row's km a day; `mounts`: how many in all;
 * `riders`: who has to be carried (the caller says); `short`: how many riders have no mount; with any short, they walk (WALK_PACE).
 * `slowest`: the slowest row's name (the first of equals).
 */
export function mountsPace(state, riders = 1) {
    const rows = mountRows(state);
    if (!rows.length) return null;
    const slowest = rows.reduce((best, row) => (row.pace < best.pace ? row : best), rows[0]);
    const mounts = rows.reduce((sum, row) => sum + row.count, 0);
    const people = Math.max(1, Number.isSafeInteger(riders) ? riders : 1);
    const short = Math.max(0, people - mounts);
    return { pace: short > 0 ? WALK_PACE : slowest.pace, mounts, riders: people, short, slowest: slowest.name };
}

// A where that only says the row is with the party and who rides it: nothing, "with the party", "ridden by …", or a list of
// members and no one else. A group's rider list says all of it.
const SAYS_WITH = /^\s*(?:with the party\s*)?$/i;
function onlyRiders(where, crew) {
    if (SAYS_WITH.test(where) || /^\s*ridden\s+by\s/i.test(where)) return true;
    // "led by Tam", "pulled by …": the verb says more than who.
    if (/\sby\s/i.test(where)) return false;
    const parts = where.split(/\s*(?:,|&|\band\b)\s*/i).filter(part => part.trim());
    return parts.length > 0 && ridersOf(where, crew).length === parts.length;
}

const countOf = row => (row.count > 1 ? ` ×${row.count}` : '');

const entryOf = row => {
    const about = [row.kind, `${row.pace} km/day`, row.condition, row.where].filter(Boolean);
    return `${row.name}${countOf(row)} (${about.join(', ')})`;
};

// Several rows said once: the shared facts, then each name (a `~ mount` line is by name) with what only it says (its condition,
// and with the party any where that is more than its riders).
function groupEntry(rows, crew, withParty) {
    const [first] = rows;
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const riders = withParty ? [...new Set(rows.filter(row => onlyRiders(row.where, crew)).flatMap(row => ridersOf(row.where, crew)))] : [];
    const where = withParty ? `with the party${riders.length ? ` (${riders.join(', ')})` : ''}` : first.where;
    const names = rows.map(row => {
        const own = [row.condition, withParty && !onlyRiders(row.where, crew) ? row.where : ''].filter(Boolean);
        return `${row.name}${countOf(row)}${own.length ? ` (${own.join(', ')})` : ''}`;
    });
    return `${first.kind || 'mount'} ×${total} (${first.pace} km/day) ${where}: ${names.join(', ')}`;
}

/**
 * The narrator's line for the tail, or null with no mount: "Mounts: Grey Mare (horse, 35 km/day, ridden by Wessel);
 * Burr (mule, 25 km/day, tired, led)". Rows of one kind and pace that travel with the party (travelsWith, as the bag judges it)
 * are said as one, "horse ×3 (35 km/day) with the party (Rav, Torka): Bay Gelding, Roan (lame), Dun (led by Tam)", as are rows
 * left at one same where. `crew`: the party's names.
 */
export function mountsTail(state, crew = []) {
    const rows = mountRows(state);
    if (!rows.length) return null;
    const place = state?.domains?.scene?.place?.name ?? '';
    const groups = new Map();
    for (const row of rows) {
        const withParty = travelsWith(row.where, place, crew);
        const key = JSON.stringify([foldKey(row.kind), row.pace, withParty ? null : row.where]);
        if (!groups.has(key)) groups.set(key, { withParty, rows: [] });
        groups.get(key).rows.push(row);
    }
    const text = [...groups.values()].map(group => (group.rows.length > 1 ? groupEntry(group.rows, crew, group.withParty) : entryOf(group.rows[0])));
    return `Mounts: ${text.join('; ')}`;
}
