// Why a roll's difficulty floor is what it is: the parts of the scene that raised it, in words the reader can check.
import { floorIndex } from '../rules/difficulty.js';
import { THREAT_WORDS } from '../words/threat.js';
import { liveConditions } from './conditions.js';

/** The names of what raises a floor for `member` now: a threat that sets one, the live conditions (each adds a step), and a drained body for a physical roll. */
export function floorWhy(member, { threat = 0, now = null, drained = false, physical = false } = {}) {
    const why = [];
    if (floorIndex({ threat }) > 0) why.push(`threat ${THREAT_WORDS[threat]}`);
    for (const item of liveConditions(member, now)) why.push(String(item.name));
    if (drained && physical) why.push('drained');
    return why;
}
