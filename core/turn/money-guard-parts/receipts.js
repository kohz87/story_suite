// Reads the stored receipts of the few replies before a message.

import { readRecord } from '../../persist.js';

/** How many messages back the guard looks for the same payment. */
export const GUARD_REPLIES = 4;

/** The stored receipts of the replies before message `index` (at most `replies` messages back, default GUARD_REPLIES; the reader's own skipped). */
export function earlierReceipts(chat, index, replies = GUARD_REPLIES) {
    const out = [];
    let seen = 0;
    for (let at = index - 1; at >= 0 && seen < replies; at -= 1) {
        const message = chat?.[at];
        if (!message || message.is_user || message.is_system) continue;
        seen += 1;
        out.push(...(readRecord(message)?.receipts ?? []));
    }
    return out;
}
