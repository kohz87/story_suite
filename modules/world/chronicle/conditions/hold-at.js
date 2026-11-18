// Which conditions hold at a ref (spec §2 Scope hierarchy): one set there, or at a broader ref containing it (the place a district
// sits under, its region, its realm), never one set narrower; a local clear the daily step keeps as a mask hides a broader one there
// only. The same walk as the daily step's (daily/holds-read.js), on the stored table. Pure.

import { isInt } from '../domain-parts/shared-basics.js';
import { ancestors } from '../../daily/geo-scope.js';

const low = text => String(text ?? '').trim().toLowerCase();
const active = (entry, now) => Boolean(entry) && (entry.holds?.length > 0 || !(isInt(now) && isInt(entry.fadesAt) && entry.fadesAt <= now));

/**
 * The entries of `table` that hold at `at`, narrowest first, each `{ key, ...entry, level }` (`level`: 0 at the ref itself, then one
 * per step out). `levels`: the refs to walk when the map does not know `at` (a place only the atlas has); default `[at]`.
 */
export function holdingAt(table, { geo, at, now = null, masks = {}, levels = null }) {
    const walk = (geo ? ancestors(geo, at) : []).length ? ancestors(geo, at) : (levels ?? [at]);
    const rows = Object.entries(table ?? {}).map(([key, entry]) => ({ key, ...entry }));
    const names = [...new Set(rows.map(entry => entry.name))].sort();
    const out = [];
    for (const name of names) {
        for (const [level, ref] of walk.entries()) {
            if (masks[`${name}@${ref}`]) break;
            const found = rows.find(entry => entry.name === name && low(entry.ref) === low(ref) && active(entry, now));
            if (found) { out.push({ ...found, level }); break; }
        }
    }
    return out.sort((a, b) => a.level - b.level || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
