// Holds a fight-start choice in chat metadata: read it back, set it, clear it.

import { hashText } from '../../../modules/assist/common.js';
import { readRecord } from '../../persist.js';

const KEY = 'rpgFightStart';
// A running check is page-local. A copied or reloaded metadata object cannot still have a call in flight.
const working = new WeakMap();
const anchorOf = chat => readRecord(chat?.at(-2))?.sid;
const keyOf = message => hashText(String(message?.mes ?? '').trim());

export function pendingStart(meta, chat) {
    const pending = meta?.[KEY], last = chat?.at(-1);
    if (!pending || !last?.is_user || !pending.anchor || pending.anchor !== anchorOf(chat) || pending.message !== keyOf(last)
        || (pending.mode === 'working' && working.get(meta) !== pending)) return null;
    return pending;
}

export function holdStart(meta, chat, value = {}) {
    const last = chat?.at(-1), anchor = anchorOf(chat);
    if (!meta || typeof meta !== 'object' || !last?.is_user || !anchor || !String(last.mes ?? '').trim()) return null;
    const pending = { anchor, message: keyOf(last), mode: 'known', choice: null, ...value };
    meta[KEY] = pending;
    if (pending.mode === 'working') working.set(meta, pending); else working.delete(meta);
    return pending;
}

export function clearStart(meta, expected = null) {
    if (meta && typeof meta === 'object' && (!expected || meta[KEY] === expected)) {
        working.delete(meta);
        delete meta[KEY];
    }
}
