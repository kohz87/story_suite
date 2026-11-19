// What a reply's journal entry is found by (N7): the reply's own ID (its sid, which survives a swipe back, a middle delete, a rewind and a reload) plus a
// fingerprint of its text (an edit makes a new reply of it). Without a host there is no sid and no entry. The host's way to read a sid is set once by the
// narration part. The fingerprint is the lineage message hash (lineage/message-hash.js), the same strings the journal always stored.

import { messageFingerprint } from '../../lineage/message-hash.js';

let sidOf = () => null;
/** Sets how the sid of the reply at an index is read (null while there is no host). */
export function useReplySids(read) {
    sidOf = typeof read === 'function' ? read : () => null;
}
/** { key, fp, sid } for the reply at `messageId` of `chat`, or null when the index is not a message or the reply has no sid (no host). */
export function journalKeyOf(chat, messageId) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= (chat?.length ?? 0)) return null;
    let sid = null;
    try { sid = sidOf(messageId); } catch { sid = null; }
    return typeof sid === 'string' && sid ? { key: `sid:${sid}`, fp: messageFingerprint(chat[messageId] || {}), sid } : null;
}
