// Reply record: tells whether a chat message gets inline cards.

import { readRecord } from '../../../../core/persist.js';

/**
 * Does message `index` of `chat` get inline cards? Only a reply after the reader's first message (not the
 * greeting) that carries a v2 record for its shown swipe.
 */
export function hasReplyRecord(chat, index) {
    const message = chat?.[index];
    if (!message || message.is_user) return false;
    const firstUser = chat.findIndex(item => item?.is_user);
    if (firstUser < 0 || index < firstUser) return false;
    return readRecord(message) !== null;
}
