/* NPC State after the chat was swiped, regenerated, edited, had a message deleted or was opened (role: settle). The store's timeline moves the people
   with the head (the adapter hydrates the cache), so nothing is rolled back here: the swipe settlement waits for the host's swipe to end, the merged
   and delayed requests wait for the message gate, and a reply received while the chat was opening is handed to the ordinary receipt once they settle.
   The branch journal that rolled the dossiers back to a checkpoint was removed at B4-10a. Built by index.js once per module instance with the shared
   runtime state. */

import { getContext } from '../../../../../../extensions.js';
import { messageGateSettled } from '../transcript/transcript.js';
import { chatLineage, firstLineageDivergence } from '../lineage/index.js';

export function createSettlePart(rt, deps) {
    const { branchInheritancePending, deferUntilSettled, ensureChatStateLoaded, getChatKey, getChatState, handleAssistantMessageReceived, isHostSwipeActive } = deps;

    const SWIPE_SETTLE_POLL_MS = 80;
    const SWIPE_SETTLE_TIMEOUT_MS = 120000;

    function operationPriority(value) {
        return ({ auto: 0, edit: 1, delete: 2, swipe: 3 })[String(value || 'auto').toLowerCase()] ?? 0;
    }

    function mergeSettleOptions(base = {}, incoming = {}) {
        const next = { ...base, ...incoming };
        const baseOperation = String(base.operation || 'auto').toLowerCase();
        const incomingOperation = String(incoming.operation || 'auto').toLowerCase();
        next.operation = operationPriority(incomingOperation) >= operationPriority(baseOperation) ? incomingOperation : baseOperation;
        return next;
    }

    function queueSettledSwipeReconcile(options = {}) {
        const originKey = options.chatKey || getChatKey();
        if (originKey === 'no-chat') return;
        let next = { reason: 'message-swiped', ...options, operation: options.operation || 'auto', chatKey: originKey };

        // A normal settle timer must never be allowed to fire inside SillyTavern's swipe window. Fold it into the swipe settlement instead.
        if (rt.branchReconcileTimer) {
            clearTimeout(rt.branchReconcileTimer);
            rt.branchReconcileTimer = null;
        }
        if (rt.branchReconcilePending) {
            next = mergeSettleOptions(rt.branchReconcilePending, next);
            rt.branchReconcilePending = null;
        }
        if (rt.swipeSettlementPending) next = mergeSettleOptions(rt.swipeSettlementPending, next);
        rt.swipeSettlementPending = next;

        const sequence = ++rt.swipeSettlementSequence;
        if (rt.swipeSettlementTimer) clearTimeout(rt.swipeSettlementTimer);
        const startedAt = Date.now();

        const poll = async () => {
            if (sequence !== rt.swipeSettlementSequence) return;
            if (getChatKey() !== originKey) {
                rt.swipeSettlementTimer = null;
                rt.swipeSettlementPending = null;
                rt.deferredSwipeMessageId = null;
                return;
            }
            if (isHostSwipeActive()) {
                if (Date.now() - startedAt >= SWIPE_SETTLE_TIMEOUT_MS) {
                    rt.swipeSettlementTimer = null;
                    rt.swipeSettlementPending = null;
                    rt.deferredSwipeMessageId = null;
                    console.warn('[NPC State Delta] swipe stayed active too long; the settle pass was skipped to avoid hijacking the host generation pipeline.');
                    return;
                }
                rt.swipeSettlementTimer = setTimeout(poll, SWIPE_SETTLE_POLL_MS);
                return;
            }

            rt.swipeSettlementTimer = null;
            const pending = rt.swipeSettlementPending || {};
            rt.swipeSettlementPending = null;
            // The swiped reply is read again through the store's head (people-sync's rescan), not here.
            rt.deferredSwipeMessageId = null;
            try {
                await reconcileCurrentBranch({ ...pending, reason: `${pending.reason || 'message-swiped'}-settled` });
            } catch (error) {
                console.warn('[NPC State Delta] settled swipe pass failed', error);
            }
        };

        // The host emits MESSAGE_SWIPED before Generate('swipe'). Polling the host's own
        // swipe state keeps NPC State Delta completely out of that pre-generation gap.
        rt.swipeSettlementTimer = setTimeout(poll, 0);
    }

    let loadingReceipts = null;
    const hostChecks = new Set();

    function loadingReconcilePending(key = getChatKey()) {
        const sequence = rt.chatOpenSequence || 0;
        const owned = item => item?.key === key && item.sequence === sequence;
        const pending = rt.branchReconcilePending;
        return branchInheritancePending(key) || rt.openingHostChats.has(key) || owned(loadingReceipts)
            || (pending?.chatKey === key && (!pending.operation || pending.operation === 'auto')) || [...hostChecks].some(owned);
    }

    // A reply received while the chat is still opening (or still waiting for its state file, runtime-chat-branch.js branchInheritancePending) waits:
    // keep its position and parent in memory, then give it to the ordinary receipt owner once the settle pass has run.
    function deferLoadingReceipt(messageId) {
        const key = getChatKey();
        const sequence = rt.chatOpenSequence || 0;
        if (!loadingReconcilePending(key)) return false;
        const chat = getContext().chat || [];
        const message = chat[messageId];
        if (!Number.isInteger(messageId) || messageId < 0 || !message || message.is_user || message.is_system || !String(message.mes || '').trim()) return false;
        if (loadingReceipts?.key !== key || loadingReceipts.sequence !== sequence) loadingReceipts = { key, sequence, items: [] };
        const parent = chatLineage(chat).slice(0, messageId);
        if (!loadingReceipts.items.some(item => item.messageId === messageId && firstLineageDivergence(item.parent, parent) === -1)) {
            loadingReceipts.items.push({ messageId, parent });
        }
        queueBranchReconcile({ chatKey: key, reason: 'message-received-pending' }, 400);
        return true;
    }

    async function deliverLoadingReceipts(key, sequence) {
        if (loadingReceipts?.key !== key || loadingReceipts.sequence !== sequence) return;
        const receipts = loadingReceipts.items;
        loadingReceipts = null;
        for (const { messageId, parent } of receipts) {
            if (getChatKey() !== key || (rt.chatOpenSequence || 0) !== sequence) return;
            const chat = getContext().chat || [];
            const message = chat[messageId];
            if (message && !message.is_user && !message.is_system && firstLineageDivergence(parent, chatLineage(chat).slice(0, messageId)) === -1) {
                await handleAssistantMessageReceived(messageId);
            }
        }
    }

    /** The settle pass: waits for the message gate and the chat's state, then hands over the replies held while the chat opened. */
    async function reconcileCurrentBranch({ reason = 'branch', chatKey = null, operation = 'auto' } = {}) {
        const key = chatKey || getChatKey();
        const sequence = rt.chatOpenSequence || 0;
        if (key === 'no-chat' || getChatKey() !== key) return null;
        // (timeline) A head that moved is followed by the host first; this reads NPC State's state after.
        if (!await messageGateSettled()) {
            // Not dropped: it runs, with every request made meanwhile merged, when the barrier is down.
            return deferUntilSettled(key, { label: 'reconcile', what: 'the update after a deleted or swiped message', options: { reason, chatKey, operation }, merge: mergeSettleOptions, retry: options => reconcileCurrentBranch(options) }, null, null);
        }
        if (getChatKey() !== key) return null;
        if ((rt.chatOpenSequence || 0) !== sequence) return null;
        await ensureChatStateLoaded(key);
        if (getChatKey() !== key || (rt.chatOpenSequence || 0) !== sequence) return null;
        await deliverLoadingReceipts(key, sequence);
        return { state: getChatState(key), operation };
    }

    function queueBranchReconcile(options = {}, delay = 90) {
        const originKey = options.chatKey || getChatKey();
        if (originKey === 'no-chat') return;
        options = { ...options, chatKey: originKey };
        if (isHostSwipeActive()) {
            queueSettledSwipeReconcile(options);
            return;
        }
        let next = { ...options };
        if (rt.branchReconcilePending?.chatKey && rt.branchReconcilePending.chatKey !== originKey) {
            if (rt.branchReconcileTimer) clearTimeout(rt.branchReconcileTimer);
            rt.branchReconcileTimer = null;
            rt.branchReconcilePending = null;
        }
        if (rt.branchReconcilePending) next = mergeSettleOptions(rt.branchReconcilePending, next);
        rt.branchReconcilePending = next;
        if (rt.branchReconcileTimer) clearTimeout(rt.branchReconcileTimer);
        rt.branchReconcileTimer = setTimeout(async () => {
            const pending = rt.branchReconcilePending || {};
            rt.branchReconcilePending = null;
            rt.branchReconcileTimer = null;
            let check = null;
            try {
                if (pending.chatKey && getChatKey() !== pending.chatKey) return;
                if (!pending.operation || pending.operation === 'auto') {
                    check = { key: pending.chatKey || getChatKey(), sequence: rt.chatOpenSequence || 0 };
                    hostChecks.add(check);
                }
                await reconcileCurrentBranch(pending);
            } catch (error) {
                console.warn('[NPC State Delta] settle pass failed', error);
            } finally {
                if (check) hostChecks.delete(check);
            }
        }, delay);
    }

    return { queueSettledSwipeReconcile, reconcileCurrentBranch, queueBranchReconcile, deferLoadingReceipt, loadingReconcilePending };
}
