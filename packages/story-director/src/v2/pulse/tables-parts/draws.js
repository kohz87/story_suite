// The roll's draw order and the d20, pick and draw helpers.

import { count, unitOf } from './shared-counts.js';

export const DRAW_ORDER = Object.freeze(['d20', 'actor', 'line']);

/** The d20 from one draw in [0, 1): 1 to 20. */
export const d20Of = unit => 1 + Math.floor(unitOf(unit) * 20);

/** The index of a pick among `length` from one draw in [0, 1); -1 when there is nothing to pick. */
export function pickIndex(length, unit) {
    return count(length) ? Math.floor(unitOf(unit) * count(length)) : -1;
}

/** The three draws of a roll, in DRAW_ORDER: `{ d20, actor, line }` as units in [0, 1). `rng` is ctx.rng (or any draw). */
export function drawsFrom(rng) {
    const out = {};
    for (const name of DRAW_ORDER) out[name] = unitOf(rng());
    return out;
}
