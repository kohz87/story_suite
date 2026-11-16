// Reads the mount rows, the party's pace and the narrator's mounts line from the state.

import { isPlainObject } from '../domains/common.js';
import { DEFAULT_PACE, WALK_PACE } from './pace.js';

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

/**
 * The narrator's line for the tail, or null with no mount: "Mounts: Grey Mare (horse, 35 km/day, ridden by Wessel);
 * Guild remounts ×4 (horse, 35 km/day); Burr (mule, 25 km/day, tired, led)".
 */
export function mountsTail(state) {
    const rows = mountRows(state);
    if (!rows.length) return null;
    const text = rows.map(row => {
        const about = [row.kind, `${row.pace} km/day`, row.condition, row.where].filter(Boolean);
        return `${row.name}${row.count > 1 ? ` ×${row.count}` : ''} (${about.join(', ')})`;
    });
    return `Mounts: ${text.join('; ')}`;
}
