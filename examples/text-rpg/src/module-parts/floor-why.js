// Why a roll's difficulty floor is what it is: the parts of the scene that raised it, in words the reader can check.
import { liveConditions } from './conditions.js';

/** The names of what raises a floor for `member` now: the live conditions (each adds a step) and a drained body for a physical roll. */
export function floorWhy(member, { now = null, drained = false, physical = false } = {}) {
    const why = liveConditions(member, now).map(item => String(item.name));
    if (drained && physical) why.push('drained');
    return why;
}
