// Story Director v2: the keys of per-reply entries kept in a map (the Director's problems, the atlas's trip records).
//
// An entry is keyed `<sid>.<n>`: the record ID of the reply it is stored on (Story Block's ctx.carrier.sid, else ctx.reply.sid,
// as loot offers are keyed) and a count within that reply. A replayed `add` is applied as written: a key made from the live
// revision (`<rev>.<n>`, the older form) lands on one a later reply already stored once an earlier reply is edited and Re-read
// with more lines, and that later reply's entry overwrites it. A reply's record ID is its own, so its keys cannot meet another's.
// So entries are put in order by what they hold (`entryOrder`), never by their key's first part.
// Older states keep their `<rev>.<n>` keys: they read and sort as before, and never meet a new key (a record ID is not a number).

/** An entry key: `<rev>.<n>` (older states, or a host that gives no record ID) or `<sid>.<n>`. */
export const REPLY_KEY = /^(?:\d{1,12}|[A-Za-z][\w:-]{0,79})\.\d{1,6}$/;

const SID = /^[A-Za-z][\w:-]{0,79}$/;

// The count part of a key (`<…>.<n>`), -1 for a key not of either form.
const countOf = key => (REPLY_KEY.test(key) ? Number(key.slice(key.lastIndexOf('.') + 1)) : -1);

// The record ID of the reply the command's changes are stored on (the capture's carrier, else ctx.reply), or null.
function replyId(ctx) {
    for (const sid of [ctx?.carrier?.sid, ctx?.reply?.sid]) if (typeof sid === 'string' && SID.test(sid)) return sid;
    return null;
}

/**
 * A new key in `map` for an entry of the reply `ctx` runs for: `<sid>.<n>` with `n` one past the highest that reply holds (so an
 * entry pruned from the front never has its count used again), or `<rev>.<n>`, the first free `n`, when the host gives no record ID.
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
