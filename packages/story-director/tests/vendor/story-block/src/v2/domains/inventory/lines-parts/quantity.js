// The quantity a story line gives: what one line can give of an item, and the quantity written on a line.

import { labelOf, parseCount } from '../../common.js';
import { MAX_UNSTACKED } from '../state.js';
import { itemText } from '../validate.js';

// `qty` of a def a story line gives: all of it, except a thing that does not stack, which is held to what one
// line can give (each piece is a stack of its own, grantInto), so a loot offer is always one its Take can
// give: { qty, problem }. `more`: a raised count (`~ item … | qty:`); `verb`: how the Problems list says it.
export function storyItems(def, qty, more = false, verb = 'given') {
    const given = def.stack ? qty : Math.min(qty, MAX_UNSTACKED);
    return {
        qty: given,
        problem: given < qty ? `${itemText(def.name, qty)}${more ? ' more' : ''} was written, but ${def.name} does not stack and at most ${MAX_UNSTACKED} can be given at once; ${given} were ${verb}.` : null,
    };
}

export function lineQty(ctx, line, fallback) {
    const written = labelOf(line, 'qty', 'quantity', 'count');
    if (written === null) return fallback;
    const n = parseCount(written);
    if (n === null) ctx.fail('INVALID', `"${written}" is not a quantity.`);
    return n;
}
