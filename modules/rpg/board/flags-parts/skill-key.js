// Builds the stable override key for one named skill in a slot.

import { fold } from '../../read.js';

/** A stable key for one named skill in a slot (not a list position used for reply bookkeeping). */
export function skillKey(module, skill) {
    return JSON.stringify([String(module ?? ''), Number(skill?.slot) || 0, fold(skill?.name ?? '')]);
}
