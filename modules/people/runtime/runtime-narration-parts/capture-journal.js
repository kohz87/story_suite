// The capture journal: finding a reply's accepted capture entry and recording accepted captures, read marks and fills.

import { chatLineage, lineageCheckpointKey } from '../../legacy/branch.js';

// (ONEPASSCAPR2-1) Accepted captures and admission fills are canonical reply-owned inputs, not diagnostic model responses.
// The full lineage key prevents a swipe, edit or different parent from borrowing another reply's capture.
export function captureJournalEntry(state, chat, messageId) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= chat.length) return null;
    const key = lineageCheckpointKey(chatLineage(chat), messageId);
    return (state?.captureJournal || []).find(item => item?.messageId === messageId && item.key === key) || null;
}
export function recordAcceptedCapture(state, chat, messageId, capture) {
    const key = lineageCheckpointKey(chatLineage(chat), messageId);
    const entries = Array.isArray(state.captureJournal) ? state.captureJournal.filter(item => item?.key !== key) : [];
    // (EDITKEEP3) A capture re-applied after an edit brings the fills and refreshes its reply had accepted (no model call).
    const entry = { messageId, key, backgroundRule: 1, parsed: structuredClone(capture.parsed), watch: structuredClone(capture.watch || []), fills: structuredClone(capture.fills || {}) };
    if (capture.refreshes) entry.refreshes = structuredClone(capture.refreshes);
    entries.push(entry);
    state.captureJournal = entries;
}
// A reply read live under the current reading rules (a scanner read has no payload to keep): replay reads it under the same rules, while a
// reply with no entry (read before this existed) is a historical re-read and keeps its old bytes.
export function recordReadMark(state, chat, messageId) {
    if (!Number.isInteger(messageId) || messageId < 0 || messageId >= chat.length || captureJournalEntry(state, chat, messageId)) return;
    state.captureJournal = [...(Array.isArray(state.captureJournal) ? state.captureJournal : []), { messageId, key: lineageCheckpointKey(chatLineage(chat), messageId), backgroundRule: 1, fills: {} }];
}
export function recordAcceptedFill(state, chat, messageId, npcId, parsed, kind = 'fills') {
    const entry = captureJournalEntry(state, chat, messageId);
    if (entry) (entry[kind] ??= {})[npcId] = structuredClone(parsed);
}
