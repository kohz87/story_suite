// World events, the evaluation environment of one event's conditions: the view plus the extra calls, bound to its `where`.

import { WORLD_ARITY, worldCalls } from '../world-calls.js';

/** `view` (`{ state, query }`) with the world-events calls wired in for `def` (its first `where`, the other events by id). */
export function worldEnv(view, def, defs) {
    const events = new Map(defs.map(entry => [entry.id, entry]));
    return { ...view, parseCalls: WORLD_ARITY, calls: worldCalls(view, { where: def?.where?.[0] ?? null, events }) };
}
