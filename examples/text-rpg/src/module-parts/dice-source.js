// Where a reply's dice come from: the receipt of the `textRpg.dice` step that preceded it, and the per-reply record the `? try` lines keep in the domain.
import { LIMITS } from '../domain/shape.js';
import { diceOf } from '../dice/record.js';

const TYPE = 'textRpg.dice';
const entryOf = item => (item && typeof item === 'object' && item.receipt && typeof item.receipt === 'object' ? item : { index: null, receipt: item });
const stepsOf = list => (Array.isArray(list) ? list : []).map(entryOf).filter(({ receipt }) => receipt?.type === TYPE);

/** The `{ list, floor }` of the latest dice step among receipts (or `{ index, receipt }` entries), or null: what the next reply is offered. */
export function lastDice(receipts) {
    return diceOf(stepsOf(receipts).at(-1)?.receipt.data);
}

/**
 * The dice step that went before the reply at carrier `index`. A normal send's step sits on the carrier before the reply; a swipe's or regenerate's
 * (`data.own`) on the reply's own carrier. Steps of later replies sit after it (on its carrier, once they are sent) and steps of earlier swipes' own are
 * theirs, so a Re-read of an earlier reply never reads another reply's dice.
 */
export function diceBefore(index, entries, own = []) {
    const mine = [...stepsOf(own).filter(({ receipt }) => receipt.data?.own === true), ...stepsOf(entries).filter(entry => entry.index === index && entry.receipt.data?.own === true)];
    const before = stepsOf(entries).filter(entry => Number.isInteger(entry.index) && entry.index < index && entry.receipt.data?.own !== true);
    return diceOf((mine.at(-1) ?? before.at(-1))?.receipt.data);
}

/**
 * The record of the reply being read, `slice.dice[sid]`: made from its dice step on the first roll, then kept with its `used`, `hardest` and `threat`.
 * null when there are no dice.
 */
export function recordOf(ctx, slice) {
    const sid = ctx.reply?.sid;
    if (!sid) return null;
    if (slice.dice[sid]) return slice.dice[sid];
    const drawn = diceBefore(ctx.reply.index, ctx.receipts(), ctx.standingReceipts ?? []);
    if (!drawn) return null;
    slice.dice[sid] = drawn;
    const keys = Object.keys(slice.dice);
    for (const key of keys.slice(0, Math.max(0, keys.length - LIMITS.diceReplies))) delete slice.dice[key];
    return slice.dice[sid];
}
