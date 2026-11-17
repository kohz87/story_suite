/* NPC State Delta capture catch-up (role: capture-catchup). The quiet Refresh that a one-pass chat gives its most-seen NPCs every
   `narrationCaptureCatchUp` captured replies (rolling: at most `narrationCaptureCatchUpPeople` people after each reply). It runs on its own schedule and no longer runs the backfill queue (that is started once
   per reply by scheduleReplyBackfills). One model call per established NPC per reply: an NPC the catch-up takes is skipped by that
   reply's backfill. A newly met NPC (a new admission whose backfill has not tried) is the exception: the catch-up's targeted Refresh
   writes its structured appearance, so it gets the Refresh AND its backfill (never skipped, its queue entry kept). Built by runtime-scan.js; nothing here is saved. */

import { getSettings } from '../settings/runtime-settings.js';
import { chatContext, latestMessageId } from './runtime-scan-helpers.js';
import { pickRolling } from './catchup-pick.js';
import { dropTook, replyRolls, setRoll } from './catchup-history.js';

export function createCatchUpPart(rt, deps) {
    const { getChatKey, getChatState, isHostSwipeActive, isScanBusy, persist, processPendingBackfills, refreshNpcFromChat, readSettings = getSettings } = deps;
    // chat key -> ids the catch-up has in hand for the current reply (memory only); scheduleReplyBackfills skips them.
    const taken = rt.catchUpTaken ?? (rt.catchUpTaken = new Map());

    // (1.2.11) One-pass catch-up. Mannerisms, levers and memories fill from evidence gathered over
    // scenes, and a block written beside the story tends to leave them thin, while a Refresh (which
    // reads a window of scenes) fills them. So after each captured reply the NPCs most in the last
    // `narrationCaptureCatchUp` replies who have waited that long get a quiet Refresh (rolling, N17 Nov).
    const CATCH_UP_LOOKBACK = 20;   // replies the picker reads back, in waits: a person unseen by a Refresh for 3 waits is overdue, the rest of the reach only orders them
    const CATCH_UP_RETRY_MS = 3000;
    const CATCH_UP_RETRIES = 20;

    const queueEntry = (chatKey, id) => (getChatState(chatKey).pendingBackfills || []).find(item => item?.npcId === id);
    // (A new-person stub's fill-in is not counted here on purpose: it is already its own call, and a Refresh that works covers it, so the queued fill is dropped like any established person's repair.)
    // A newly met NPC: a new admission whose backfill has not tried yet. It gets both the Refresh and the backfill.
    const newlyMet = (chatKey, id) => { const entry = queueEntry(chatKey, id); return entry?.reason === 'new-admission' && !(Number(entry.attempts) > 0); };

    /** Rolling catch-up: notes who is in this captured reply and returns the NPC ids it Refreshes now, or []. After each reply at most K people go; each one
     *  waits N replies between Refreshes (catchup-pick.js). The marks live on the reply's journal entry (catchup-history.js), so a replay reads the same ones. */
    function noteCaptureCatchUp(chatKey, npcIds = [], messageId = null) {
        const every = Math.max(0, Math.round(Number(readSettings().narrationCaptureCatchUp) || 0));
        const state = getChatState(chatKey);
        const chat = chatContext().chat || [];
        if (!every || !state || !Number.isInteger(messageId)) return [];
        if (!setRoll(state, chat, messageId, 'seen', npcIds.filter(Boolean))) return [];
        const history = replyRolls(state, chat, messageId, CATCH_UP_LOOKBACK * every);
        const due = pickRolling(history, every, readSettings().narrationCaptureCatchUpPeople);
        setRoll(state, chat, messageId, 'took', due);
        persist();
        // Every due NPC is held from the reply's own backfill start (it would race the Refresh for the chat and could win it, leaving a
        // newly met NPC without the Refresh); a newly met NPC's backfill runs right after the Refresh instead (runCaptureCatchUp).
        if (due.length) taken.set(chatKey, new Set(due));
        return due;
    }

    async function runCaptureCatchUp(chatKey, ids, tries = 0, at = null) {
        if (!ids.length || getChatKey() !== chatKey) { taken.delete(chatKey); return; }
        if (isScanBusy(chatKey) || isHostSwipeActive()) {
            if (tries < CATCH_UP_RETRIES) setTimeout(() => void runCaptureCatchUp(chatKey, ids, tries + 1, at), CATCH_UP_RETRY_MS);
            else taken.delete(chatKey);
            return;
        }
        const established = [];
        try {
            for (const id of ids) {
                if (getChatKey() !== chatKey) return;
                if (!getChatState(chatKey).npcs.some(npc => npc.id === id && !npc.archived)) continue;
                const fresh = newlyMet(chatKey, id);
                if (!fresh) established.push(id);
                const refreshed = await refreshNpcFromChat(id, { automatic: true, fillLooks: false, ...(Number.isInteger(at) ? { at } : {}) }); // (ONEPASSCAPR2-3) the admission backfill owns the single fill
                if (!refreshed && Number.isInteger(at) && getChatKey() === chatKey) { dropTook(getChatState(chatKey), chatContext().chat || [], at, id); persist(); }   // not Refreshed: still waiting, so they lead next time
                // A Refresh that worked has covered an established person; the queued repair would only repeat it. A newly met one keeps its backfill.
                if (refreshed && !fresh && getChatKey() === chatKey) {
                    const latest = getChatState(chatKey);
                    if ((latest.pendingBackfills || []).some(item => item?.npcId === id)) {
                        latest.pendingBackfills = latest.pendingBackfills.filter(item => item?.npcId !== id);
                        persist();
                    }
                }
            }
        } finally { taken.delete(chatKey); }
        // The reply's own backfill start finds the chat busy while the Refresh runs; a newly met NPC's backfill runs now (one call).
        if (getChatKey() === chatKey) await processPendingBackfills(latestMessageId(true), { limit: 0, skipNpcIds: established, admissions: true }); // (ONEPASSCAPR2-3) drain admissions queued during any refresh
    }

    /** A replayed hosted reply (N7): what the live catch-up did for it is in the reply's journal entry (`catchUp`: the people it took; `refreshes`: the answers it kept).
     *  Repeats the Refreshes from those answers (the scan's own replay does it for a reply that had a scan) and returns the ids the reply's backfill skips, as live. */
    async function replayCatchUp(entry, at, scanned) {
        const chatKey = getChatKey();
        const skip = [];
        for (const id of Array.isArray(entry?.catchUp) ? entry.catchUp : []) {
            if (!getChatState(chatKey).npcs.some(npc => npc.id === id && !npc.archived)) continue;
            const fresh = newlyMet(chatKey, id);
            if (!fresh) skip.push(id);
            if (scanned || !entry.refreshes?.[id]) continue;
            if (await refreshNpcFromChat(id, { automatic: true, fillLooks: false, at }) && !fresh) {
                const latest = getChatState(chatKey);
                latest.pendingBackfills = (latest.pendingBackfills || []).filter(item => item?.npcId !== id);
            }
        }
        return skip;
    }

    return { noteCaptureCatchUp, runCaptureCatchUp, replayCatchUp };
}
