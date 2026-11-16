// Chooses the table from real counts and resolves a d20 to a kind that can happen here.

import { count } from './shared-counts.js';
import { STANDARD, DUO, STANDARD_MIN_NAMED, STANDARD_MIN_OFFSCREEN } from './table-ids.js';
import { DEFAULT_GROUP } from './place-groups.js';
import { TABLES } from './table-rows.js';
import { ACTOR_NEEDS } from './kind-rules.js';
import { FLAVOUR } from './flavour-data.js';
import { flavourLines } from './flavour-lines.js';

/** 'std' when the counts give the Standard table (3+ named, some off-screen), else 'duo'. */
export function tableFor({ named = 0, offscreen = 0 } = {}) {
    return count(named) >= STANDARD_MIN_NAMED && count(offscreen) >= STANDARD_MIN_OFFSCREEN ? STANDARD : DUO;
}

/** Whether `kind` can happen here with these counts (and is not in `blocked`): CALM always can; a flavour kind needs a line; an effect kind needs its actor. */
export function possibleKind(kind, { group = DEFAULT_GROUP, weather = null, counts = {}, blocked = null } = {}) {
    if (kind === 'CALM') return true;
    // `blocked`: kinds the caller found it cannot build here (an effect with no one to act on), stepped past like an impossible one.
    if (blocked?.has?.(kind)) return false;
    const need = ACTOR_NEEDS[kind];
    if (need === undefined) return false;
    if (need !== 'none' && count(counts?.[need]) === 0) return false;
    return FLAVOUR[kind] ? flavourLines(kind, group, weather).length > 0 : true;
}

/**
 * The entry a d20 gives at this place and with these counts: the row's kind, or, when it cannot happen here, the next
 * row down (wrapping) until one can. `{ kind, d20, table, steps }`; `steps` counts the rows passed. Draws nothing.
 */
export function resolveKind(tableId, d20, context = {}) {
    const table = TABLES[tableId] ? tableId : DUO;
    const rows = TABLES[table].rows;
    const roll = Number.isFinite(d20) ? Math.min(20, Math.max(1, Math.trunc(d20))) : 1;
    let index = rows.findIndex(entry => roll >= entry.from && roll <= entry.to);
    let steps = 0;
    while (!possibleKind(rows[index].kind, context)) {
        index = (index + 1) % rows.length;
        steps += 1;
    }
    return { kind: rows[index].kind, d20: roll, table, steps };
}
