// Finds a reply's earlier board and links the reader's message to it for a regenerate.
import { LAST, LINKS } from './shared-keys.js';
import { object } from './shared-meta.js';

/** A previous swipe's own receipt is the authority for that reply's fight. */
export function priorBoard(message) {
    const records = [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])];
    for (const record of records) for (const receipt of record?.receipts ?? []) {
        const payload = receipt?.type === 'rpg.resolve' ? receipt.replan?.payload : null;
        if (object(payload?.board)) return structuredClone(payload);
    }
    return null;
}

/** The cache covers a regenerate only when this reader message was linked to that fight. */
export const lastBoard = (meta, anchor, message = null) => {
    const saved = meta?.[LAST];
    const linked = object(message?.extra?.[LINKS]) && message.extra[LINKS][saved?.key] === true;
    return saved?.board && linked ? structuredClone(saved) : null;
};

/** Link the user's message to its reply's board key for regenerate after a middle delete. */
export function linkBoard(message, key) {
    if (!object(message) || typeof key !== 'string') return;
    if (!object(message.extra)) message.extra = {};
    if (!object(message.extra[LINKS])) message.extra[LINKS] = {};
    message.extra[LINKS][key] = true;
}
