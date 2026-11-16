// Chronicle's event states and the fixed orders its events and factions are listed in.

import { MAX_KEPT } from './limits-caps.js';
import { OPEN_STATES } from './limits-ids.js';
import { isInt } from './shared-basics.js';

export const isOpen = event => OPEN_STATES.includes(event?.state);

/** Whether a pack event wrote the entry (`by`): the story's own lines may not change its state. */
export const isLocked = event => typeof event?.by === 'string';

/** The open entries held in every tail (`keep`), at most MAX_KEPT, the most recently updated first (id breaks ties). */
export function keptEvents(chronicle) {
    const at = event => (isInt(event.updated) ? event.updated : -Infinity);
    return Object.values(chronicle?.events ?? {}).filter(event => event?.keep === true && isOpen(event))
        .sort((a, b) => at(b) - at(a) || (b.rev ?? 0) - (a.rev ?? 0) || (a.id < b.id ? -1 : 1)).slice(0, MAX_KEPT);
}

/** Events in a fixed order: open first (newest news first), then resolved (newest first); id breaks ties. */
export function orderedEvents(chronicle) {
    const at = event => (isInt(event.updated) ? event.updated : -Infinity);
    return Object.values(chronicle?.events ?? {}).sort((a, b) => Number(isOpen(b)) - Number(isOpen(a))
        || at(b) - at(a) || (b.rev ?? 0) - (a.rev ?? 0) || (a.id < b.id ? -1 : 1));
}
