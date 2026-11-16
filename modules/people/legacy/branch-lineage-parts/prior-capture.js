// Finding the capture kept for a reply whose edit moved it to a new lineage key.

// (EDITKEEP3) A real edit moved a reply to a new key and its block is no longer in its text (NSD removed it on receipt): the capture NSD kept for that
// same reply (same position, key before the edit, same parents) is applied again. `oldKeys`/`newKeys` are the lineage keys before and after the edit.
// Any other reply (a different parent, a swipe, another position) gets nothing.
export function priorCaptureFor(journal, messageId, oldKeys, newKeys) {
    if (!Array.isArray(journal) || !Number.isInteger(messageId) || messageId < 0 || !oldKeys?.[messageId] || !newKeys?.[messageId]) return null;
    if (messageId > 0 && oldKeys[messageId - 1] !== newKeys[messageId - 1]) return null;
    const entry = journal.find(item => item?.parsed && item.messageId === messageId && item.key === oldKeys[messageId]);
    return entry ? { parsed: structuredClone(entry.parsed), raw: '', watch: structuredClone(entry.watch || []), fills: structuredClone(entry.fills || {}), ...(entry.refreshes ? { refreshes: structuredClone(entry.refreshes) } : {}) } : null;
}
