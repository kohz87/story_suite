// Reading and checking the quantity, owner and text arguments of a stack command.

import { OWNER_RE, isPlainObject } from '../../scene/domains/common.js';
import { trimText } from '../../scene/names.js';
import { isCount } from '../state.js';

export function count(ctx, value, fallback, what = 'quantity') {
    const n = value === undefined || value === null ? fallback : value;
    if (!isCount(n, 1)) ctx.fail('INVALID', `The ${what} must be a whole number of at least 1.`);
    return n;
}

export function ownerArg(ctx, value, fallback = 'party') {
    const owner = value === undefined || value === null ? fallback : value;
    if (typeof owner !== 'string' || !OWNER_RE.test(owner)) ctx.fail('INVALID', 'Items and coins belong to the party or to one of its people.');
    return owner;
}

// An actor who can hold things now (B3-7): the party, or a member the party module lists
// (`party.actors` when a module answers it, else the `party` domain's actors). An `ac_` id nobody
// has is refused, so nothing is handed to someone who is not there.
function ownerKnown(ctx, owner) {
    if (owner === 'party') return true;
    try {
        const list = ctx.query('party.actors');
        if (Array.isArray(list)) return list.some(actor => actor?.id === owner);
    } catch { /* no module answers party.actors: the domain, if there is one */ }
    let party = null;
    try { party = ctx.read('party'); } catch { party = null; }
    return isPlainObject(party?.actors) && Object.hasOwn(party.actors, owner);
}

export function receiverArg(ctx, value, fallback = 'party') {
    const owner = ownerArg(ctx, value, fallback);
    if (!ownerKnown(ctx, owner)) ctx.fail('REFUSED', `${owner} is not in the party, so nothing can be given to them.`);
    return owner;
}

export function textArg(ctx, value, max, what) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') ctx.fail('INVALID', `The ${what} must be text.`);
    return trimText(value, max);
}
