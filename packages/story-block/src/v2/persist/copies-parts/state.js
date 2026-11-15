// Story Suite v2: whether a carrier keeps a swipe_info copy, and whether a deleted swipe is still loading.

import { KEY, isObject, isCarrier } from '../carrier.js';


/**
 * Does this carrier keep its shown swipe's record in `swipe_info` too? Yes when it is the last carrier
 * (`last`: the one the reader can swipe), or when it has more than one swipe (a branch can be made from
 * one of them, see the top of this file).
 */
export function keepsCopy(message, last) {
    return !!last || (Array.isArray(message?.swipes) && message.swipes.length > 1);
}

/**
 * SillyTavern's deleteSwipe tells of the deletion (MESSAGE_SWIPE_DELETED) before it shows the swipe that takes the
 * deleted one's place (then MESSAGE_SWIPED): until then `extra` and `mes` are the deleted swipe's and `swipe_id` is the
 * next one's. `deleted` is the index of the swipe that went (the event's `swipeId`). True while the shown swipe is in
 * that state, told by whose record `extra` holds, not by its text: the record is stamped with the deleted swipe's
 * index, or the shown slot holds another swipe's own record than `extra` does, or the text is not the slot's.
 * Nothing is written to a record meanwhile.
 */
export function swipeLoading(message, deleted = null) {
    if (!isCarrier(message) || !Array.isArray(message.swipes) || !Array.isArray(message.swipe_info)) return false;
    const swipe = message.swipe_id;
    if (!Number.isInteger(swipe) || swipe < 0 || swipe >= message.swipes.length) return false;     // (no swipe left to show)
    const record = message.extra?.[KEY];
    if (Number.isInteger(deleted) && isObject(record) && record.swipe === deleted) return true;
    const there = message.swipe_info[swipe]?.extra?.[KEY];
    if (isObject(record) && isObject(there) && message.swipe_info[swipe].extra !== message.extra && there.sid !== record.sid
        && !message.swipe_info.some(info => info?.extra?.[KEY]?.sid === record.sid)) return true;
    return message.swipes[swipe] !== message.mes;
}
