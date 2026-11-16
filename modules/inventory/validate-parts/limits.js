// Reads the slot counts in force (accessory and worn) from the `items.slots` query.

import { isPlainObject } from '../../common.js';
import { MANY_SLOTS, MAX_MANY } from './slots.js';
import { asking } from './shared-asking.js';

/** The slot counts in force: { accessory, worn } from `items.slots`, else MANY_SLOTS. */
export function slotLimits(query) {
    const given = asking(query, 'items.slots', {});
    const pick = name => {
        const n = isPlainObject(given) ? given[name] ?? given[`${name === 'accessory' ? 'accessories' : `${name}s`}`] : undefined;
        return Number.isSafeInteger(n) ? Math.max(0, Math.min(MAX_MANY, n)) : MANY_SLOTS[name];
    };
    return { accessory: pick('accessory'), worn: pick('worn') };
}
