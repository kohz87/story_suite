// Story Suite v2: writing, restoring and dropping the shown swipe's swipe_info copy of the record.

import { KEY, isObject, swipeOf } from '../carrier.js';

/** Copies the record in `message.extra` into the shown swipe's `swipe_info` (when it has one). */
export function mirrorCopy(message) {
    const record = message?.extra?.[KEY];
    const info = Array.isArray(message?.swipe_info) ? message.swipe_info[swipeOf(message)] : null;
    if (!isObject(record) || !isObject(info)) return false;
    // The slot already holds the record of another swipe that is stamped as this slot's own (a deleted shown swipe's record
    // is in `extra` until the next swipe is loaded): it is never written over.
    const there = info.extra?.[KEY];
    if (info.extra !== message.extra && isObject(there) && there.sid !== record.sid && there.swipe === swipeOf(message)) return false;
    if (!isObject(info.extra)) info.extra = {};
    if (info.extra !== message.extra) info.extra[KEY] = structuredClone(record);
    return true;
}

/**
 * The copy a rebuild gives the last carrier back (an earlier one became the last). Only for a message at
 * rest: its shown swipe's text is the one shown, and that swipe's `swipe_info` holds no other record.
 * SillyTavern's deleteSwipe tells of a deleted swipe (MESSAGE_SWIPE_DELETED) before it shows the next
 * one: then `extra` is still the deleted swipe's and the slot under `swipe_id` is the next swipe's own,
 * which must not be written over. True when it copied.
 */
export function restoreCopy(message) {
    const record = message?.extra?.[KEY];
    const swipe = swipeOf(message);
    const info = Array.isArray(message?.swipe_info) ? message.swipe_info[swipe] : null;
    if (!isObject(record) || !isObject(info) || info.extra === message.extra) return false;
    if (Array.isArray(message.swipes) && message.swipes[swipe] !== message.mes) return false;
    const there = isObject(info.extra) ? info.extra[KEY] : undefined;
    if (there !== undefined && !(isObject(there) && there.sid === record.sid)) return false;
    return mirrorCopy(message);
}

/**
 * Drops the shown swipe's copy of the record in `message.extra` from `swipe_info` (only a copy of that
 * same record, by `sid`; a copy of anything else is left alone). True when it dropped one.
 */
export function dropCopy(message) {
    const own = message?.extra?.[KEY];
    const info = Array.isArray(message?.swipe_info) ? message.swipe_info[swipeOf(message)] : null;
    const copy = isObject(info?.extra) && info.extra !== message.extra ? info.extra[KEY] : undefined;
    if (!isObject(own) || !isObject(copy) || copy.sid !== own.sid) return false;
    delete info.extra[KEY];
    return true;
}
