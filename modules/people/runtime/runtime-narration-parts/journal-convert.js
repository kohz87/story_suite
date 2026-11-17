// The one-time move of a chat's capture journal from the lineage key to the reply's sid (N7). A chat that started before the switch has entries keyed by the
// lineage key; each one that still matches a message of the chat is re-keyed to that reply's sid with the fingerprint of its text (journal-keys.js), and an entry that
// matches no message (a swiped-away or deleted reply's) is dropped. Runs once after a hydrate while hosted; idempotent (`captureJournalKeys` is set; a second run finds
// nothing to do). Nothing is converted while the host cannot say a sid yet (the entries wait). The recipe it reads old keys with is the frozen copy in journal-lineage.js.

import { frozenFingerprint, frozenLineageKeys } from './journal-lineage.js';

export const JOURNAL_KEYS_VERSION = 2;

/** `sidAt(index)` → the reply's sid | null. Returns { converted, dropped, waiting } (all 0 once the journal is in the new keys). */
export function convertJournal(state, chat, sidAt) {
    const report = { converted: 0, dropped: 0, waiting: 0 };
    if (!state || state.captureJournalKeys === JOURNAL_KEYS_VERSION) return report;
    const entries = Array.isArray(state.captureJournal) ? state.captureJournal : [];
    const old = entries.filter(item => item && !String(item.key).startsWith('sid:'));
    if (!old.length) { state.captureJournalKeys = JOURNAL_KEYS_VERSION; return report; }
    const messages = Array.isArray(chat) ? chat : [];
    const keys = frozenLineageKeys(messages);
    const kept = [];
    for (const item of entries) {
        if (!item || String(item.key).startsWith('sid:')) { if (item) kept.push(item); continue; }
        const at = Number.isInteger(item.messageId) && keys[item.messageId] === item.key ? item.messageId : -1;
        if (at < 0) { report.dropped += 1; continue; }
        const sid = sidAt(at);
        if (typeof sid !== 'string' || !sid) { report.waiting += 1; kept.push(item); continue; }
        kept.push({ ...item, messageId: at, key: `sid:${sid}`, fp: frozenFingerprint(messages[at]) });
        report.converted += 1;
    }
    state.captureJournal = kept;
    if (!report.waiting) state.captureJournalKeys = JOURNAL_KEYS_VERSION;
    return report;
}
