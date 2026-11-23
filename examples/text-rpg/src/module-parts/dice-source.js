// Where a reply's dice come from: the receipt of its `textRpg.dice` step, and the per-reply record the `? try` lines keep in the domain.
import { LIMITS } from '../domain/shape.js';
import { diceOf } from '../dice/record.js';

const TYPE = 'textRpg.dice';
const plain = entry => (entry && typeof entry === 'object' && entry.receipt && typeof entry.receipt === 'object' ? entry.receipt : entry);

/** The `{ list, floor }` the latest dice step recorded, from a list of receipts (or `{ index, receipt }` entries), or null. */
export function lastDice(receipts) {
    const found = (Array.isArray(receipts) ? receipts : []).map(plain).filter(receipt => receipt?.type === TYPE).at(-1);
    return diceOf(found?.data);
}

/**
 * The record of the reply being read, `slice.dice[sid]`: made from the reply's own dice step on the first roll (a Re-read finds that step among the
 * reply's own receipts, a first reading among the receipts before it), then kept with its `used`, `hardest` and `threat`. null when there are none.
 */
export function recordOf(ctx, slice) {
    const sid = ctx.reply?.sid;
    if (!sid) return null;
    if (slice.dice[sid]) return slice.dice[sid];
    const drawn = lastDice(ctx.standingReceipts) ?? lastDice(ctx.receipts());
    if (!drawn) return null;
    slice.dice[sid] = drawn;
    const keys = Object.keys(slice.dice);
    for (const key of keys.slice(0, Math.max(0, keys.length - LIMITS.diceReplies))) delete slice.dice[key];
    return slice.dice[sid];
}
