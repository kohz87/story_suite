/* NPC State queued dossier backfills (role: backfill-queue). Runs the pending backfills of one reply: up to BACKFILL_PARALLEL at a time
   (their model calls overlap; each one's merge still lands whole and alone), and says "filled in" once for the batch, not once each.
   Split from runtime-targeted-backfill.js. The pass itself is backfillNpcFromHistory, and the replay and relevance reads are injected (replayLacksFill, stillRelevant). */

import { FILL_REASON, fillPolicy, fillFailureNote } from '../meters/npc-lines-parts/fill-in.js';

export const BACKFILL_PARALLEL = 3;
const BACKFILL_RETRY_COOLDOWN_MS = 60 * 1000;

/** The one toast for a batch of finished backfills (one name reads as before), or null when none finished. */
export function backfillBatchNote(names) {
    if (!names.length) return null;
    return names.length === 1
        ? `NPC State: backfilled ${names[0]} from recent story context.`
        : `NPC State: backfilled ${names.length} people (${names.join(', ')}) from recent story context.`;
}

export function createBackfillQueuePart(deps) {
    const { BACKFILL_MAX_ATTEMPTS, backfillNpcFromHistory, replayLacksFill, stillRelevant, getChatKey, getChatState, isHostSwipeActive, isScanBusy, persist, requireReadyChatMutation, parallel = BACKFILL_PARALLEL } = deps;

    async function processPendingBackfillsInner(messageId = null, { limit = Infinity, skipNpcIds = [], admissions = false } = {}) {
        const chatKey = getChatKey();
        if (chatKey === 'no-chat' || !requireReadyChatMutation('process queued dossier backfills', chatKey, { notify: false }) || isScanBusy(chatKey) || isHostSwipeActive()) return 0;
        let processed = 0;
        // Model calls made (each backfill is one request, plus a compact retry at most).
        let calls = 0;
        let stopped = false;
        const batch = { done: [] };   // who this batch filled in: one toast at the end
        const running = new Set();
        const attemptedNpcIds = new Set(skipNpcIds);
        // Sibling backfills of this batch hold the chat too; only another kind of work ends the batch.
        const clear = () => getChatKey() === chatKey && !stopped && !isScanBusy(chatKey, { ignoreParallel: true });

        // What a finished backfill leaves in the queue.
        async function settle(request, attempts, succeeded) {
            if (succeeded === null) { stopped = true; return; }
            if (getChatKey() !== chatKey || !requireReadyChatMutation('settle queued dossier backfill', chatKey, { notify: false })) { stopped = true; return; }
            // (1.10.1) A scan that began while this backfill was getting ready holds the chat: the backfill made no request (it found the chat
            // busy). Writing the queue now would change the dossier state under that scan, which then discards its result; the request stays
            // queued, uncounted, for the next run.
            if (isScanBusy(chatKey, { ignoreParallel: true })) { stopped = true; return; }
            const latest = getChatState(chatKey);
            const currentRequest = (latest.pendingBackfills || []).find(item => item.npcId === request.npcId);
            if (!currentRequest || currentRequest.requestedAt !== request.requestedAt || currentRequest.requestedMessageId !== request.requestedMessageId) return;
            if (!succeeded) {
                const queued = (latest.pendingBackfills || []).find(item => item.npcId === request.npcId);
                if (queued) {
                    queued.attempts = attempts + 1;
                    queued.lastAttemptAt = Date.now();
                    if (request.lastError) queued.lastError = request.lastError;
                    if (queued.attempts >= fillPolicy(queued, { max: BACKFILL_MAX_ATTEMPTS, cooldown: true }).max) {
                        latest.pendingBackfills = latest.pendingBackfills.filter(item => item.npcId !== request.npcId);
                        if (!queued.silent) globalThis.toastr?.warning?.(queued.reason === FILL_REASON ? fillFailureNote(queued.label) : `NPC State: automatic backfill for ${queued.label} failed ${BACKFILL_MAX_ATTEMPTS} times and was removed from the retry queue. The dossier itself was not deleted.`);
                    }
                }
                persist();
                // One failed dossier must not starve other queued targeted repairs.
                return;
            }
            latest.pendingBackfills = (latest.pendingBackfills || []).filter(item => item.npcId !== request.npcId);
            persist();
            processed += 1;
        }

        while (clear()) {
            const state = getChatState(chatKey);
            if (!Array.isArray(state.pendingBackfills) || !state.pendingBackfills.length) break;
            // (ONEPASSCAPR2-3) Hosted one-pass: each new admission owns its queued fill, once (the four-stubs-a-reply cap in npc-lines-parts/stub.js bounds it); the per-reply cap still limits other repairs.
            const request = state.pendingBackfills.find(item => item?.npcId && !attemptedNpcIds.has(item.npcId)
                && (calls < limit || (admissions && fillPolicy(item).ownsCall)));
            if (!request) break;
            attemptedNpcIds.add(request.npcId);
            if (replayLacksFill(request)) continue; // (ONEPASSCAPR2-1) an unaccepted fill cannot be invented by replay
            if (!stillRelevant(request, state.npcs.find(npc => npc.id === request.npcId), state.npcs)) {
                state.pendingBackfills = state.pendingBackfills.filter(item => item.npcId !== request.npcId);
                persist();
                continue;
            }
            const attempts = Math.max(0, Math.round(Number(request.attempts) || 0));
            const policy = fillPolicy(request, { max: BACKFILL_MAX_ATTEMPTS, cooldown: true });
            if (attempts >= policy.max) {
                state.pendingBackfills = state.pendingBackfills.filter(item => item.npcId !== request.npcId);
                persist();
                if (!request.silent) globalThis.toastr?.warning?.(request.reason === FILL_REASON ? fillFailureNote(request.label) : `NPC State: stopped automatic backfill retries for ${request.label} after ${BACKFILL_MAX_ATTEMPTS} failed attempts. The bare dossier is preserved; use Scan dossier to retry manually.`);
                continue;
            }
            const lastAttemptAt = Math.max(0, Number(request.lastAttemptAt || 0) || 0);
            if (policy.cooldown && attempts > 0 && lastAttemptAt && Date.now() - lastAttemptAt < BACKFILL_RETRY_COOLDOWN_MS) continue;

            calls += 1;
            const task = backfillNpcFromHistory(request, messageId, { automatic: true, parallel: true, batch })
                .then(succeeded => settle(request, attempts, succeeded))
                .finally(() => running.delete(task));
            running.add(task);
            if (running.size >= parallel) await Promise.race(running);
        }
        await Promise.all(running);
        const note = backfillBatchNote(batch.done);
        if (note) globalThis.toastr?.success?.(note);
        return processed;
    }

    return { processPendingBackfillsInner };
}
