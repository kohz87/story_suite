// The tainted mark of a chat holding story state (markUsed) and the page's browser storage (pageStorage).

// The page's localStorage, or null (none, or blocked: reading it can throw).
export function pageStorage(page) {
    try { return page?.localStorage ?? null; } catch { return null; }
}

/**
 * Marks a chat holding story state as used (chat_metadata.tainted). SillyTavern treats an untainted chat
 * holding only the greeting as pristine and replaces that greeting (and the record on it) when the
 * character card is saved or the chat is renamed.
 */
export function markUsed(metadata, chat) {
    if (!metadata || typeof metadata !== 'object' || metadata.tainted) return;
    if ((chat ?? []).some(message => message?.extra?.storySuite)) metadata.tainted = true;
}
