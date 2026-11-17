// What a reply's journal entry is found by (N7). Hosted, the reply's own ID (its sid, which survives a swipe back, a middle delete, a rewind and a reload) plus a
// fingerprint of its text (an edit makes a new reply of it); not hosted, the lineage key as before. The host's way to read a sid is set once by the narration part.

import { frozenFingerprint, frozenLineageKey } from './journal-lineage.js';

let sidOf = () => null;
/** Sets how the sid of the reply at an index is read (null while there is no host); not hosted every reply keeps its lineage key. */
export function useReplySids(read) {
    sidOf = typeof read === 'function' ? read : () => null;
}
/** { key, fp?, sid? } for the reply at `messageId` of `chat`, or null when the index is not a message. */
export function journalKeyOf(chat, messageId) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= (chat?.length ?? 0)) return null;
    let sid = null;
    try { sid = sidOf(messageId); } catch { sid = null; }
    if (typeof sid === 'string' && sid) return { key: `sid:${sid}`, fp: frozenFingerprint(chat[messageId]), sid };
    return { key: frozenLineageKey(chat, messageId) };
}
