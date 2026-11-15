// Finding the stack an id means, a short-stock message and the stacks of a def.

import { itemText } from '../validate.js';
import { takeOrder } from './shared-order.js';

export function stackIn(ctx, inv, id) {
    const stack = typeof id === 'string' ? inv.stacks[id] : null;
    if (!stack) ctx.fail('NOT_FOUND', 'That item is no longer in the inventory.');
    return stack;
}

export function shortOf(name, have) {
    return have === 0 ? `There is no ${name} left.` : `There is only ${itemText(name, have)} left.`;
}

export function stacksOf(inv, defId, owner = null) {
    return Object.values(inv.stacks).filter(stack => stack.def === defId && (owner === null || stack.owner === owner)).sort(takeOrder);
}
