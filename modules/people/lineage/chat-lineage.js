// Message fingerprints: the flag-independent fingerprint of one message and the lineage of a whole chat.
import { messageFingerprint } from './message-hash.js';

export function fingerprintMessage(message = {}) {
    // Lineage is narrative-content based. SillyTavern send dates, generation IDs, swipe indexes, and speaker labels are mutable host metadata
    // and never define it. So is the system flag: hiding a message (MemoryBooks and similar extensions set is_system on summarised messages)
    // does not change what was said. The flag is therefore fixed in the hash.
    return messageFingerprint(message, false);
}

export function chatLineage(chat = []) {
    return (Array.isArray(chat) ? chat : []).map(fingerprintMessage);
}
