// Arc context tail line and its token budget.

import { FEATURE } from './shared-records.js';
import { WORLD_EVENTS } from './world-constants.js';
import { currentArc } from './query.js';

/**
 * The tail's budget (tokens): one short line. It is a part of the Director module's total, so it stays as it was: the world note below is an ordinary line
 * under that total, never a larger budget (the output with the world-events switch off must not change).
 */
export const ARC_TAIL_BUDGET = 60;

/** The tail line: the current arc while it runs (its beats are in the Director note's Beats line); with world events on, a second line: the arc's world note (about 120 tokens, stored with the arc). */
export function arcTail(view) {
    const on = typeof view?.feature === 'function' ? view.feature(FEATURE) !== false : true;
    if (!on) return { lines: [], optional: [] };
    const current = currentArc(view?.state?.domains?.arc);
    if (!current?.active) return { lines: [], optional: [] };
    const lines = [`Arc: ${current.key}${current.desc ? ` — ${current.desc}` : ''}`];
    const worldOn = typeof view?.feature === 'function' && view.feature(WORLD_EVENTS) === true;
    if (worldOn && typeof current.world === 'string' && current.world.trim()) lines.push(`Arc and the world: ${current.world.trim()}`);
    return { lines, optional: [] };
}
