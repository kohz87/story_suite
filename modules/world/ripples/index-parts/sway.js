// Scores each power's sway from its reasons and picks the leader.

import { clamp } from './shared-numbers.js';
import { reasonsOf } from './reasons.js';

const KINDS = Object.freeze(['quest', 'event', 'standing', 'fight']);

/**
 * The sway of every power of the table, in pack order: `[{ id, name, sway, reasons: [{ kind, text, delta, when }] }]`.
 * `inputs` is `{ quests, events, standing, fights }` (missing lists count as empty). `only` (ids) narrows the answer
 * (the scoring still reads every signal). Reasons are sorted by size, the bigger first, ties in input order.
 * No table gives [] (no Director, no section).
 */
export function swayOf(table, inputs = {}, only = null) {
    if (!table) return [];
    const reasons = reasonsOf(table, inputs ?? {});
    const rows = [];
    for (const power of table.powers) {
        if (Array.isArray(only) && !only.includes(power.id)) continue;
        const mine = reasons.get(power.id) ?? [];
        let total = 0;
        for (const kind of KINDS) {
            const sum = mine.filter(item => item.kind === kind).reduce((acc, item) => acc + item.delta, 0);
            total += clamp(sum, table.caps[kind]);
        }
        const sway = Math.max(0, Math.min(100, power.base + clamp(total, table.caps.power)));
        const sorted = [...mine].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        rows.push({ id: power.id, name: power.name, sway, reasons: sorted.map(({ kind, delta, text: line, when: at }) => ({ kind, text: line, delta, when: at })) });
    }
    return rows;
}

/**
 * The top or bottom power of `rows` (a `swayOf` answer) among the ids in `among` (null: all). Ties keep the
 * rows' order, which is pack order. Null when nothing is left to pick, or `pick` is neither 'top' nor 'bottom'.
 */
export function leaderOf(rows, { among = null, pick = 'top' } = {}) {
    const dir = pick === 'top' ? 1 : pick === 'bottom' ? -1 : 0;
    if (!dir || !Array.isArray(rows)) return null;
    const pool = rows.filter(row => !Array.isArray(among) || among.includes(row.id));
    if (!pool.length) return null;
    let best = pool[0];
    for (const row of pool.slice(1)) {
        if (dir * (row.sway - best.sway) > 0) best = row;
    }
    return best.id;
}
