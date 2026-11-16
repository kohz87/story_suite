// A member's carry capacity from STR, and the encumbered and load-band tests.

import { GEAR } from '../stats.js';

const strOf = value => (Number.isSafeInteger(value) ? Math.max(GEAR.carry.strMin, Math.min(GEAR.carry.strMax, value)) : GEAR.carry.strDefault);
/** A member's carry capacity: 10 + 2 × STR (STR held to 1…20; a missing STR counts as the default). */
export const capacityFor = str => GEAR.carry.base + GEAR.carry.perStr * strOf(str);

/** Encumbered: carrying something and at or over the capacity (100 % and more, as approved; an empty load is never encumbered). */
export const atLimit = (load, capacity) => load > 0 && load >= capacity;

/** The load bands of the Carry card: `over` (red, "Encumbered") from 100 % (the same test as the encumbered condition), `heavy` (yellow) from 80 % to below 100 %. */
export function loadLevel(load, capacity) {
    if (atLimit(load, capacity)) return 'over';
    return capacity > 0 && load * 5 >= capacity * 4 ? 'heavy' : 'normal';
}
