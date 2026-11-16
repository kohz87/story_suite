// Picks the effect entry builder for a table kind.

import { rumourEntry, meetEntry, arrivalEntry, shiftEntry } from './entries.js';

/**
 * One effect entry by kind, with the candidates in `ctx` (the builder's own options). Flavour kinds and CALM are not effects:
 * they give null here. Unknown kinds give null.
 */
export function effectFor(kind, ctx = {}) {
    if (kind === 'GOSSIP_SURGE' || kind === 'OVERHEARD_DETAIL') return rumourEntry(kind, ctx);
    if (kind === 'CHANCE_MEETING') return meetEntry(ctx);
    if (kind === 'ENTER_CHECK') return arrivalEntry(ctx);
    if (kind === 'TASK_SHIFT') return shiftEntry(ctx);
    return null;
}
