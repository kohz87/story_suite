// A story reply's money tally: what it gave, what clicks paid, and counting a line's money.

import { isPlainObject } from '../../common.js';
import { isCount } from '../state.js';

export const tallied = value => (isCount(value, 0) ? value : 0);

// The reply a tally is kept for: during a story capture its carrier's record ID; for a module's vouched
// payout outside one (a click), the reply its changes are stored on (ctx.reply, the head carrier). null
// when nothing is counted: a module's own call it does not vouch for, or a command with no reply.
function tallyId(ctx, vouched = false) {
    if (ctx.caller && !vouched) return null;
    const id = ctx.cause === 'story' ? ctx.carrier?.sid ?? ctx.carrier?.key : null;
    const out = id ?? (vouched && ctx.caller ? ctx.reply?.sid : null);
    return typeof out === 'string' && out ? out : null;
}

// What reply `id` has given so far: its stored entry, or null.
export function storedTally(inv, id) {
    return id && isPlainObject(inv?.perReply) && Object.hasOwn(inv.perReply, id) && isPlainObject(inv.perReply[id]) ? inv.perReply[id] : null;
}

// A copy of the tally for this reply (a fresh one when none is stored); null when nothing is counted
// (tallyId). A module's own call is counted only when it says the story vouched for it (`vouched`).
// Kept with keepTally.
function tallyOf(ctx, inv, vouched = false) {
    const id = tallyId(ctx, vouched);
    if (!id) return null;
    const stored = storedTally(inv, id);
    const tally = { id, coin: tallied(stored?.coin) };
    // Of `coin`, what modules' vouched payouts gave (quest rewards), kept only once there is some.
    if (tallied(stored?.vouched)) tally.vouched = tallied(stored.vouched);
    // Money the reply's lines took (`- coin`), kept only once there is some (a rules module's debit cap).
    if (tallied(stored?.debit)) tally.debit = tallied(stored.debit);
    return tally;
}

// This reply's entry, alone: other replies' entries (and an older shape's fields) go, their clicks too.
function keepTally(inv, { id, ...tally }) {
    if (!isPlainObject(inv.perReply)) inv.perReply = {};
    for (const key of Object.keys(inv.perReply)) if (key !== id) delete inv.perReply[key];
    inv.perReply[id] = tally;
    if (isPlainObject(inv.storyClicks)) for (const key of Object.keys(inv.storyClicks)) if (key !== id) delete inv.storyClicks[key];
}

// What the clicks after reply `id` paid (storyClicks).
export function clicksOf(inv, id) {
    const log = isPlainObject(inv?.storyClicks) && Object.hasOwn(inv.storyClicks, id) ? inv.storyClicks[id] : null;
    return isPlainObject(log) ? Object.values(log).reduce((sum, paid) => sum + tallied(paid), 0) : 0;
}

// A click's vouched payout: its own key under the reply (add-only), the reply's entry left as it is.
// Other replies' entries go here too (pruned by key), as keepTally drops them.
function keepClick(ctx, inv, id, paid) {
    if (isPlainObject(inv.perReply)) for (const key of Object.keys(inv.perReply)) if (key !== id) delete inv.perReply[key];
    if (!isPlainObject(inv.storyClicks)) inv.storyClicks = {};
    for (const key of Object.keys(inv.storyClicks)) if (key !== id) delete inv.storyClicks[key];
    if (!isPlainObject(inv.storyClicks[id])) inv.storyClicks[id] = {};
    const key = String(ctx.receiptId ?? 'click');
    inv.storyClicks[id][key] = tallied(inv.storyClicks[id][key]) + paid;
}

// A story line's money, counted for the reply (nothing is held back): { amount }. Counted only for a story
// line and a module's vouched payout (tallyOf).
export function storyCoin(ctx, inv, amount, vouched = false) {
    const tally = tallyOf(ctx, inv, vouched);
    if (!tally) return { amount };
    // A click (a module's vouched payout outside a capture) is kept as its own key (keepClick).
    if (vouched && ctx.cause !== 'story') {
        keepClick(ctx, inv, tally.id, amount);
    } else {
        tally.coin = Math.min(Number.MAX_SAFE_INTEGER, tally.coin + amount);
        if (vouched) tally.vouched = Math.min(Number.MAX_SAFE_INTEGER, (tally.vouched ?? 0) + amount);
        keepTally(inv, tally);
    }
    return { amount };
}
