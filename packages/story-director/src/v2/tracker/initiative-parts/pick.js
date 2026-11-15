// Story Director v2, tracker part (initiative): reads the recorded pick and tells whether it is fresh or cooling down.

import { slotValue } from '../../slot.js';
import { isInt, isRecord } from './shared-guards.js';

/** The recorded pick, or null. */
export const pickOf = director => {
    const value = slotValue(director?.initiative);
    return value && isInt(value.round) ? value : null;
};

/** Whether `pick` is the one for the reply being written now (`at`: the chat's length), as the chronicle's. */
export function pickFresh(pick, at) {
    if (!pick || !isInt(at) || !isInt(pick.at)) return false;
    return at >= pick.at && at < pick.at + 2;
}

/** The people still cooling down at `round`: Set of keys. */
export function cooling(pick, round, cooldown) {
    const out = new Set();
    for (const entry of Array.isArray(pick?.recent) ? pick.recent : []) {
        if (isRecord(entry) && typeof entry.key === 'string' && isInt(entry.round) && round - entry.round < cooldown) out.add(entry.key);
    }
    return out;
}
