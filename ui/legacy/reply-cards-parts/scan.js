// Asks each module's card about the head reply and collects the cards that answer.

import { normalizeCard } from './read.js';

/**
 * The cards under the head reply: `entries` are the registry's [{ moduleId, id, fn }] (id: "<module>/<card>"), `head` the head
 * reply's index, `messageAt(index)` the message, `stateAt(index)` the state after it (asked once, shared by every card),
 * `query(name, args, state)` the queries. Each `fn(state, message, { index, head: true, chatId, query })` is asked once; a card that
 * throws (or whose words cannot be read) is left out and never stops the others. `onEnded(id)` hears of each card that answered
 * without a card. → Map head index → [{ key, card }] (empty when there is no head).
 */
export function scanReplyCards(entries, { head = -1, messageAt = () => null, stateAt = () => null, query = () => null, chatId = '', onEnded = null } = {}) {
    const out = new Map();
    if (!Number.isInteger(head) || head < 0) return out;
    const list = (Array.isArray(entries) ? entries : []).filter(entry => typeof entry?.fn === 'function');
    if (!list.length) return out;
    let state;
    let message = null;
    try {
        state = stateAt(head);
        message = messageAt(head);
    } catch {
        return out;
    }
    const found = [];
    for (const { id, fn } of list) {
        try {
            const card = normalizeCard(fn(state, message, { index: head, head: true, chatId, query: (name, args) => query(name, args, state) }));
            if (card) found.push({ key: id, card });
            else {
                try { onEnded?.(id); } catch { /* the caller's note never stops the scan */ }
            }
        } catch {
            // One module's card never stops the others.
        }
    }
    if (found.length) out.set(head, found);
    return out;
}
