/* NPC State rolling catch-up marks (role: catchup-history). Each reply's journal entry keeps `roll`: who was in it (`seen`), who its catch-up Refreshed
   (`took`) and whose manual Refresh came after it (`manual`). The picker reads the marks of the replies the chat stands on now, so a swipe, a swipe back,
   a middle delete, a rewind, a reload and a replay read the same ones as live. */

import { journalKeyOf } from '../runtime/runtime-narration-parts/journal-keys.js';
import { captureJournalEntry, recordReadMark } from '../runtime/runtime-narration.js';

const isReply = message => Boolean(message) && !message.is_user && !message.is_system;

/** The marks of the last `count` replies up to `messageId` of `chat`, oldest first (a reply with no entry has empty marks). */
export function replyRolls(state, chat, messageId, count) {
    const rolls = [];
    for (let at = Math.min(messageId, (chat?.length ?? 0) - 1); at >= 0 && rolls.length < count; at -= 1) {
        if (!isReply(chat[at]) || !journalKeyOf(chat, at)) continue;
        const roll = captureJournalEntry(state, chat, at)?.roll;
        rolls.push({ seen: roll?.seen || [], took: roll?.took || [], manual: roll?.manual || [] });
    }
    return rolls.reverse();
}

/** Writes one mark (`seen`, `took` or `manual`) on the reply's entry (made when missing); false when the reply has none. */
export function setRoll(state, chat, messageId, field, ids) {
    const entry = recordReadMark(state, chat, messageId);
    if (!entry) return false;
    entry.roll = { ...(entry.roll || {}), [field]: [...new Set(ids)] };
    return true;
}

/** A person's manual Refresh counts as their last Refresh from the latest reply on. Returns whether a mark was written. */
export function noteManualRefresh(state, chat, id) {
    let at = (chat?.length ?? 0) - 1;
    while (at >= 0 && !isReply(chat[at])) at -= 1;
    if (at < 0 || !journalKeyOf(chat, at)) return false;
    const manual = captureJournalEntry(state, chat, at)?.roll?.manual || [];
    return setRoll(state, chat, at, 'manual', [...manual, id]);
}

/** Takes an id off a reply's `took` (its Refresh did not finish), leaving the person where they were in the queue. */
export function dropTook(state, chat, messageId, id) {
    const entry = captureJournalEntry(state, chat, messageId);
    if (entry?.roll?.took) entry.roll = { ...entry.roll, took: entry.roll.took.filter(other => other !== id) };
}
