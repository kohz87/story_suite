// The waiting choice of an interaction a module asked to open before the reader's message goes out: the record in chat metadata (`storySuiteInteraction.start`),
// read back only while it is about this very message, and the hold that makes it. A choice of `plain` releases the send (the reader chose to go on without it).

import { hashText } from '../../modules/assist/common.js';
import { readRecord } from '../persist.js';

const KEY = 'storySuiteInteraction';
// A running check is page-local: a reloaded metadata object cannot still have a call in flight.
const working = new WeakMap();
/** What the chat's waiting reader message is: the anchor reply's sid and the message's hash (`{ anchor, message }`). */
export const waitingOf = chat => ({ anchor: anchorOf(chat), message: keyOf(chat?.at(-1)) });
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const anchorOf = chat => readRecord(chat?.at(-2))?.sid;
const keyOf = message => hashText(String(message?.mes ?? '').trim());

export function pendingStart(meta, chat) {
    const pending = plain(meta?.[KEY]) ? meta[KEY].start : null, last = chat?.at(-1);
    if (!plain(pending) || !last?.is_user || !pending.anchor || pending.anchor !== anchorOf(chat) || pending.message !== keyOf(last)
        || (pending.mode === 'working' && working.get(meta) !== pending)) return null;
    return pending;
}

export function clearStart(meta, expected = null) {
    const box = plain(meta?.[KEY]) ? meta[KEY] : null;
    if (box && box.start && (!expected || box.start === expected)) {
        working.delete(meta);
        delete box.start;
        // (a box that held only the waiting choice goes with it: a chat that never played an interaction keeps the metadata it always had)
        if (!Object.keys(box).length) delete meta[KEY];
    }
}

/** Records the hold for the chat's waiting message: `{ kindId, title, mode, choice, … }` (the `id` follows the next attempt's id when a kind is named). → the record, or null. */
export function holdStart(meta, chat, value) {
    const last = chat?.at(-1), anchor = anchorOf(chat);
    if (!plain(meta) || !last?.is_user || !anchor || !String(last.mes ?? '').trim()) return null;
    if (!plain(meta[KEY])) meta[KEY] = {};
    const attempt = Number.isSafeInteger(meta[KEY].attempts?.[anchor]) ? meta[KEY].attempts[anchor] : 0;
    const pending = { anchor, message: keyOf(last), mode: 'known', choice: null, ...(typeof value?.kindId === 'string' ? { id: `${anchor}:${attempt}:${value.kindId}`, choices: [] } : {}), ...value };
    meta[KEY].start = pending;
    if (pending.mode === 'working') working.set(meta, pending); else working.delete(meta);
    return pending;
}
