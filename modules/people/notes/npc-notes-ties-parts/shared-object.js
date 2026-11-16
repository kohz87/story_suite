// The ties object helpers: the name cap, the person key, the tolerant reader and the sorted copy.
import { clean, npcKey } from '../npc-meters-config.js';
import { ordered, isPlainObject } from './shared-tags.js';

export const NAME_MAX = 120;

export const keyOf = name => npcKey(clean(name, NAME_MAX));

export function readTiesObject(ties) {
    return isPlainObject(ties) ? sortedCopy(ties) : {};
}

export function sortedCopy(ties) {
    const out = {};
    for (const key of Object.keys(ties).sort()) out[key] = ordered(ties[key]);
    return out;
}
