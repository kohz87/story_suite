// The count of Director calls this game year, for Settings (read only; switch story-director.world-events). The Director part keeps it in the
// world ledger (`chronicle.ledger`, field `calls: { count }`); until it exists, or when the ledger has none, it is 0. Pure.

import { isInt } from '../domain-parts/shared-basics.js';
import { slotValue } from '../../../rpg/slot.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

/** `chronicle.directorCalls` → `{ count }` (a whole number, 0 when none is kept), null while the switch is off. */
export const directorCallsQuery = Object.assign((state) => {
    const count = slotValue(state?.domains?.chronicle?.ledger)?.calls?.count;
    return { count: isInt(count) && count >= 0 ? count : 0 };
}, { feature: WORLD_EVENTS_FEATURE });
