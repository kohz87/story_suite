/* NPC State Delta: where a finished scan leaves the read marker and the replies read ahead. */

/** The most "read ahead" replies a chat keeps; past it the oldest are forgotten (the marker then passes the oldest unread replies instead: a reply is never read twice). */
export const READ_AHEAD_MAX = 40;

/** The ids of the replies a scan already read that the marker has not passed yet (`state.readAhead`), cleaned: integers, ascending, unique. */
export function readAheadOf(state) {
    const list = Array.isArray(state?.readAhead) ? state.readAhead : [];
    return [...new Set(list.filter(id => Number.isInteger(id) && id >= 0))].sort((a, b) => a - b);
}

/** Whether the scan has already read reply `id`: the marker is at or past it, or it was read ahead. */
export function replyScanned(state, id) {
    return Number.isInteger(id) && (state?.lastScannedMessageId === id || readAheadOf(state).includes(id));
}

/**
 * Where a finished scan leaves the marker (`lastScannedMessageId`) and the replies read ahead, so every reply is read exactly once.
 *   marker      the chat's marker before the scan (a number, or null)
 *   readAhead   the replies read ahead before the scan
 *   readIds     the replies this scan read (a window's replies, the reply of a capture, the replies of a manual scan's recent text)
 *   target      where the scan would put the marker (the newest reply it was for)
 *   replyIds    every reply of the chat the story stands on, ascending
 *   fresh       the chat was never scanned (it reads from the start)
 * The marker moves to `target` only when no reply before it is still unread; otherwise it stays, and the replies this scan read are
 * remembered, so the next window skips exactly those. Whatever follows the marker and was read ahead is taken in. With no marker to keep
 * track against (not a new chat) it moves to `target` as before. → { marker, readAhead, deferred, waiting }.
 */
export function settleScan({ marker = null, readAhead = [], readIds = [], target, replyIds = [], fresh = false } = {}) {
    const base = Number.isInteger(marker) ? marker : (fresh ? -1 : null);
    if (base === null || !Number.isInteger(target)) return { marker: target, readAhead: [], deferred: false, waiting: 0 };
    const read = new Set([...readAheadOf({ readAhead }), ...(Array.isArray(readIds) ? readIds : []).filter(Number.isInteger)]);
    const replies = (Array.isArray(replyIds) ? replyIds : []).filter(id => id > base);
    const unread = replies.some(id => id <= target && !read.has(id));
    let next = unread ? base : Math.max(base, target);
    if (!unread) {
        // Take in the replies read ahead that now follow the marker without a gap.
        for (const id of replies) {
            if (id <= next) continue;
            if (!read.has(id)) break;
            next = id;
        }
    }
    let rest = [...read].filter(id => id > next).sort((a, b) => a - b);
    // Too many read ahead (a chat of captures with something old never read): the marker passes the oldest unread replies, as it did before.
    while (rest.length > READ_AHEAD_MAX) { next = rest.shift(); rest = rest.filter(id => id > next); }
    // `deferred`: the marker stayed behind replies that are still unread; `waiting`: how many (the cadence counts them, so the safety scan still comes).
    const waiting = unread ? replies.filter(id => id > next && !read.has(id)).length : 0;
    return { marker: next, readAhead: rest.slice(-READ_AHEAD_MAX), deferred: unread, waiting };
}
