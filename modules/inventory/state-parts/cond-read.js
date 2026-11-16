// Reading a stack's condition: its events in order and the condition they fold to.

import { isPlainObject } from '../../common.js';
import { COND_MAX, clampCond } from './shared-cond.js';

/** A stack's condition events in the order they apply: [{ key, d, n }]. */
export function condEvents(inventory, stackId) {
    const log = isPlainObject(inventory?.condLog) && typeof stackId === 'string' && Object.hasOwn(inventory.condLog, stackId) ? inventory.condLog[stackId] : null;
    if (!isPlainObject(log)) return [];
    return Object.entries(log)
        .filter(([, event]) => isPlainObject(event) && Number.isSafeInteger(event.d) && Number.isSafeInteger(event.n))
        .map(([key, event]) => ({ key, d: event.d, n: event.n }))
        .sort((a, b) => a.n - b.n || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** A stack's condition, 0…100: where it starts (100, or an older plain `cond`) folded through its events. */
export function condOf(stack, inventory = null) {
    let cond = Number.isSafeInteger(stack?.cond) ? clampCond(stack.cond) : COND_MAX;
    for (const event of condEvents(inventory, stack?.id)) cond = clampCond(cond + event.d);
    return cond;
}
