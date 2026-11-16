// The ripples sway and leader queries.

import { swayOf, leaderOf } from './sway.js';
import { tableOf, inputsOf } from './reads.js';

const hasClock = state => state?.domains?.director && Number.isSafeInteger(state.domains.director.time?.minutes);

/** `ripples.sway { powers? }` → `[{ id, name, sway, reasons }]` in pack order; [] with no table or no Director. */
export function swayQuery(state, args, tools) {
    const table = tableOf(tools);
    if (!table || !state?.domains?.director) return [];
    return swayOf(table, inputsOf(state, tools, table), Array.isArray(args?.powers) ? args.powers : null);
}

/** `ripples.leader { among, pick }` → a power id, or null (no table, no Director, no clock, nothing to pick). */
export function leaderQuery(state, args, tools) {
    if (!hasClock(state)) return null;
    return leaderOf(swayQuery(state, {}, tools), { among: Array.isArray(args?.among) ? args.among : null, pick: args?.pick ?? 'top' });
}
