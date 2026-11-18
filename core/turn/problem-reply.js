// Story Suite v2: a Problems row follows its reply. A row made for reply `index` is stamped with the reply's record ID (`sid`, store.carrierSid),
// and the list as read puts each row at the place that reply is now, so a middle delete that moves the reply does not leave its old number.

import { readRecord } from '../persist.js';

/** Stamps `item` (a new row, changed in place) with the record ID of its reply, when it names one and has none yet. */
export function stampReply(item, store) {
    if (!Number.isInteger(item?.index) || typeof item.sid === 'string') return item;
    try {
        const sid = store?.carrierSid?.(item.index);
        if (typeof sid === 'string') item.sid = sid;
    } catch { /* a row without its reply's ID keeps the number it was made with */ }
    return item;
}

/**
 * The rows (copies), each at the place its reply is now: a row whose reply's record moved (an earlier message deleted) takes that
 * message's index. A row whose reply is where it was, or whose record is not on any shown message (a swipe not shown), keeps its number.
 * The chat is read only when a row's reply is no longer at its number.
 */
export function placedProblems(rows, chat) {
    const list = Array.isArray(chat) ? chat : [];
    let where = null;
    const at = sid => {
        if (where === null) {
            where = new Map();
            list.forEach((message, index) => {
                const own = readRecord(message)?.sid;
                if (typeof own === 'string' && !where.has(own)) where.set(own, index);
            });
        }
        return where.get(sid);
    };
    return rows.map(row => {
        const item = { ...row };
        if (typeof item.sid !== 'string' || !Number.isInteger(item.index) || readRecord(list[item.index])?.sid === item.sid) return item;
        const now = at(item.sid);
        if (Number.isInteger(now)) item.index = now;
        return item;
    });
}
