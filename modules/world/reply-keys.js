// Story Director v2: the keys of per-reply entries kept in a map (the Director's problems, the atlas's trip records).
//
// A reply's own story (a capture) keys its entries `<sid>.<n>`: its record ID (Story Block's ctx.carrier.sid, as loot offers are
// keyed) and a count within that reply. Any other write kept on a reply (a click, a step, an arc plan's lines) is keyed
// `<sid>:<receipt id>.<n>` (ctx.reply.sid and ctx.receiptId), so a Re-read of that reply, which writes its `<sid>.<n>` again
// and keeps such a write as stored, never meets it. Why: a replayed `add` is applied as written, and a key made from the live
// revision (`<rev>.<n>`, the older form) landed on one a later reply had already stored once an earlier reply was edited and
// Re-read with more lines; that later reply's entry then overwrote it. So entries are put in order by what they hold
// (`entryOrder`), never by their key's first part. Older states keep their `<rev>.<n>` keys: they read and sort as before and
// never meet a new key (a record ID is not a number).

/** An entry key: `<rev>.<n>` (older states, or a host that gives no record ID), `<sid>.<n>` or `<sid>:<receipt id>.<n>`. */
export const REPLY_KEY = /^(?:\d{1,12}|[A-Za-z][\w:-]{0,79})\.\d{1,6}$/;

const SID = /^[A-Za-z][\w:-]{0,47}$/;

// The count part of a key (`<…>.<n>`), -1 for a key not of either form.
export const countOf = key => (REPLY_KEY.test(key) ? Number(key.slice(key.lastIndexOf('.') + 1)) : -1);

const ID = /^[A-Za-z][\w-]{0,30}$/;

// Whose entries these are: the reply's record ID for its own story (a capture), else that ID and the receipt's own ID; null
// when the host gives no record ID.
function replyId(ctx) {
    const carrier = ctx?.carrier?.sid;
    if (ctx?.cause === 'story' && typeof carrier === 'string' && SID.test(carrier)) return carrier;
    const sid = ctx?.reply?.sid;
    if (typeof sid !== 'string' || !SID.test(sid)) return null;
    const own = typeof ctx?.receiptId === 'string' && ID.test(ctx.receiptId) ? ctx.receiptId : `r${Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0}`;
    return `${sid}:${own}`;
}

/**
 * A new key in `map` for an entry of the reply `ctx` runs for (replyId): `<id>.<n>` with `n` one past the highest that id holds (so
 * an entry pruned from the front never has its count used again), or `<rev>.<n>`, the first free `n`, when the host gives no record ID.
 */
export function replyKey(ctx, map) {
    const sid = replyId(ctx);
    if (sid === null) {
        const rev = Number.isSafeInteger(ctx?.rev) && ctx.rev >= 0 ? ctx.rev : 0;
        let n = 0;
        while (Object.hasOwn(map, `${rev}.${n}`)) n += 1;
        return `${rev}.${n}`;
    }
    let n = 0;
    for (const key of Object.keys(map)) if (key.startsWith(`${sid}.`) && countOf(key) >= n) n = countOf(key) + 1;
    return `${sid}.${n}`;
}

/**
 * A sort for `[key, entry]` pairs: by `rank(entry)` (a list of numbers, compared in turn; one not a number counts as -1), then by
 * the key's count, then by the key itself.
 */
export function entryOrder(rank) {
    const ranks = entry => rank(entry).map(value => (Number.isFinite(value) ? value : -1));
    return ([keyA, a], [keyB, b]) => {
        const [x, y] = [ranks(a), ranks(b)];
        for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1);
        return countOf(keyA) - countOf(keyB) || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0);
    };
}
