// Arc context tail line and its token budget.

import { FEATURE } from './shared-records.js';
import { currentArc } from './query.js';

/** The tail's budget (tokens): one short line. */
export const ARC_TAIL_BUDGET = 60;

/** The tail line: the current arc while it runs (its beats are in the Director note's Beats line). */
export function arcTail(view) {
    const on = typeof view?.feature === 'function' ? view.feature(FEATURE) !== false : true;
    if (!on) return { lines: [], optional: [] };
    const current = currentArc(view?.state?.domains?.arc);
    if (!current?.active) return { lines: [], optional: [] };
    return { lines: [`Arc: ${current.key}${current.desc ? ` — ${current.desc}` : ''}`], optional: [] };
}
