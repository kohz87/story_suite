// The capture journal: finding a reply's accepted capture entry and recording accepted captures, read marks and fills.
// Hosted (N7) an entry is the reply's own: found by its sid and the fingerprint of its text (journal-keys.js), so a swipe back, a middle delete, a rewind and a
// reload find it and an edit does not. Without a host (no sid) nothing is found or recorded. An entry of another key (a pre-switch lineage key) never matches.

import { journalKeyOf } from './journal-keys.js';

// (ONEPASSCAPR2-1) Accepted captures and admission fills are canonical reply-owned inputs, not diagnostic model responses.
const same = (item, at) => item?.key === at.key && item.fp === at.fp;
// `namesakes` marks rows this code kept: their replay reads shared names by the namesake rule (../../core/core-merge-namesakes.js). An entry without it replays
// its rows as they were read before that rule. Finding an older entry never marks it. A fill is marked by itself (`namesakeFills`): an older entry can gain one.
export function captureJournalEntry(state, chat, messageId) {
    const at = journalKeyOf(chat, messageId);
    return at ? (state?.captureJournal || []).find(item => same(item, at)) || null : null;
}
const stamp = (at, messageId) => ({ messageId, key: at.key, fp: at.fp });
export function recordAcceptedCapture(state, chat, messageId, capture) {
    const at = journalKeyOf(chat, messageId);
    if (!at) return;
    const old = (state.captureJournal || []).find(item => item?.key === at.key);
    const entries = Array.isArray(state.captureJournal) ? state.captureJournal.filter(item => item?.key !== at.key) : [];
    // (EDITKEEP3) A capture re-applied after an edit brings the fills and refreshes its reply had accepted (no model call).
    const entry = { ...stamp(at, messageId), backgroundRule: 1, namesakes: 1, parsed: structuredClone(capture.parsed), watch: structuredClone(capture.watch || []), fills: structuredClone(capture.fills || {}) };
    if (capture.refreshes) entry.refreshes = structuredClone(capture.refreshes);
    if (old?.roll) entry.roll = structuredClone(old.roll);   // the catch-up marks belong to the reply, not to its text: an edited Re-read keeps them
    entries.push(entry);
    state.captureJournal = entries;
}
// A reply read live under the current reading rules (a scanner read has no payload to keep; a hosted reply with no scan has none either): replay reads it under the
// same rules, while a reply with no entry (read before this existed) is a historical re-read and keeps its old bytes. Returns the reply's entry (made when missing).
export function recordReadMark(state, chat, messageId) {
    const at = journalKeyOf(chat, messageId);
    if (!at) return null;
    const found = (state.captureJournal || []).find(item => same(item, at));
    if (found) return found;
    const entry = { ...stamp(at, messageId), backgroundRule: 1, namesakes: 1, fills: {} };
    const old = (state.captureJournal || []).find(item => item?.key === at.key);
    if (old?.roll) entry.roll = structuredClone(old.roll);
    // A stale entry of an edited reply (same sid, other text) is replaced, not kept beside it.
    state.captureJournal = [...(Array.isArray(state.captureJournal) ? state.captureJournal : []).filter(item => item?.key !== at.key), entry];
    return entry;
}
export function recordAcceptedFill(state, chat, messageId, npcId, parsed, kind = 'fills') {
    const entry = captureJournalEntry(state, chat, messageId);
    if (!entry) return;
    (entry[kind] ??= {})[npcId] = structuredClone(parsed);
    entry.namesakeFills = [...new Set([...(entry.namesakeFills || []), `${kind}:${npcId}`])];
}
