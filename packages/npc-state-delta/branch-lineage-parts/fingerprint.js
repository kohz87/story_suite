// Message fingerprints: the flag-independent one, the legacy flag-sensitive one and the lineage of a whole chat.
import { messageFingerprint, noteMessageText } from './shared-message-fingerprint.js';

export function fingerprintMessage(message = {}) {
    noteMessageText(message);
    // Destructive lineage is narrative-content based. SillyTavern send dates, generation IDs,
    // swipe indexes, and speaker labels are mutable host metadata and never define durable state.
    // So is the system flag: hiding a message (MemoryBooks and similar extensions set is_system on
    // summarised messages) does not change what was said, and a lineage that followed the flag
    // invalidated every later checkpoint key whenever a message was hidden or unhidden. The flag is
    // therefore fixed in the hash, which keeps the value earlier versions stored for ordinary messages.
    return messageFingerprint(message, false);
}

// The value earlier versions stored for a message whose system flag was set (hidden or system).
export function legacySystemFingerprint(message = {}) {
    return messageFingerprint(message, true);
}

export function chatLineage(chat = []) {
    return (Array.isArray(chat) ? chat : []).map(fingerprintMessage);
}
