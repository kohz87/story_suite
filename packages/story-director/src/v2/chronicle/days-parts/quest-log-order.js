// Story Director v2, chronicle part: the quest history's keys and their order. Pure.
//
// `chronicle.questLog` holds two kinds of key. The note keeps each receipt's line under that receipt's revision
// (`"<rev>"`, digits). A thread's outcome (`chronicle.threadOutcome`, written inside a reply's capture) is keyed by
// its reply (`replyKey`, `<sid>.<n>` or `<sid>:<receipt id>.<n>`; `<rev>.<n>` from a host with no record ID) and
// keeps the revision it was told at (`rev`), so a later reply's stored note never lands on it after an edited
// Re-read. Lines are put in order by that revision (a digits key is its own), never by a reply key.

import { REPLY_KEY } from '../../reply-keys.js';
import { isRecord } from './shared-values.js';

/** A quest history key: a receipt's revision (the note's), or a reply key (a thread's outcome). */
export const QUEST_LOG_KEY = key => /^\d{1,15}$/.test(key) || REPLY_KEY.test(key);

/** Where a line sits in its thread's history: the revision it was told at (-1 when it has none). */
export function questLogRank(key, entry) {
    if (/^\d{1,15}$/.test(key)) return Number(key);
    return isRecord(entry) && Number.isSafeInteger(entry.rev) ? entry.rev : -1;
}

/** A sort for `[key, entry]` pairs of the quest history: by revision, a note's line (digits) before an outcome of the same one, then by key. */
export function questLogOrder([keyA, a], [keyB, b]) {
    const byRev = key => /^\d{1,15}$/.test(key);
    return questLogRank(keyA, a) - questLogRank(keyB, b) || Number(byRev(keyB)) - Number(byRev(keyA)) || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0);
}
