// What gear changes on a sheet: the pool sizes read with the gear on and the per-stat bonus the rolls use (both read, never stored).
import { STAT_KEYS } from '../words/stats.js';
import { effectiveStats, poolOf } from './effective.js';
import { totalStats } from './gear.js';

/** The pool as it reads with the gear on: the size from the stats with gear (capped by rarity), `now` the counter read clamped to it. */
export function poolWith(member, kind, cap = {}) {
    return poolOf(member, kind, totalStats(member, cap));
}

/** The gear bonus per stat the rolls use: `{ STR: 2 }` for the stats gear raises, after the cap and the 1..30 bound; `{}` for none. */
export function bonusOf(member, cap = {}) {
    const stats = effectiveStats(member);
    const total = totalStats(member, cap);
    return Object.fromEntries(STAT_KEYS.map(key => [key.toUpperCase(), total[key] - Math.min(30, Math.max(1, stats[key]))]).filter(([, n]) => n > 0));
}
