// Reply helpers: the frozen { index, sid } reply, the head reply and the reply at an index.
// `{ index, sid }` frozen, or null without a usable sid.
export function replyOf(index, sid) {
    return Number.isInteger(index) && index >= 0 && typeof sid === 'string' && sid ? Object.freeze({ index, sid }) : null;
}

/**
 * The reply a command outside a capture is stored on (`ctx.reply`): the head carrier, store.append's,
 * with the record ID its record has or will get (store.carrierSid). null for a store that cannot say.
 */
export function headReply(store) {
    try {
        const index = typeof store?.headIndex === 'function' ? store.headIndex() : -1;
        return typeof store?.carrierSid === 'function' && Number.isInteger(index) && index >= 0 ? replyOf(index, store.carrierSid(index)) : null;
    } catch {
        return null;
    }
}

/** The reply at carrier `index` (`ctx.reply` for a read as of that reply), or null when the store cannot say. */
export function replyAt(store, index) {
    try { return typeof store?.carrierSid === 'function' ? replyOf(index, store.carrierSid(index)) : null; } catch { return null; }
}
