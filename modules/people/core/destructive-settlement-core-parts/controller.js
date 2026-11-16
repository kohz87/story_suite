// The destructive-settlement controller: waits for a delete or edit to settle in the chat, then reconciles once.
import { narrativeLineage, firstNarrativeDivergence, destructiveMutationSettled } from './lineage.js';

export function createDestructiveSettlementController({
    getChat,
    getChatKey,
    reconcile,
    probe = () => null,
    isSwipeActive = () => false,
    setTimer = (fn, delay) => setTimeout(fn, delay),
    clearTimer = timer => clearTimeout(timer),
    now = () => Date.now(),
    pollMs = 50,
    timeoutMs = 5000,
    onTimeout = () => {},
    onError = () => {},
} = {}) {
    if (typeof getChat !== 'function' || typeof getChatKey !== 'function' || typeof reconcile !== 'function') {
        throw new TypeError('Destructive settlement controller requires getChat, getChatKey, and reconcile functions.');
    }

    let timer = null;
    let pending = null;
    let sequence = 0;

    const cancel = () => {
        if (timer !== null) clearTimer(timer);
        timer = null;
        pending = null;
        sequence += 1;
    };

    const poll = async token => {
        if (token !== sequence || !pending) return false;
        const currentPending = pending;
        if (getChatKey() !== currentPending.chatKey) {
            cancel();
            return false;
        }

        const liveLineage = narrativeLineage(getChat());
        if (!isSwipeActive() && destructiveMutationSettled(currentPending.operation, currentPending.baselineLineage, liveLineage)) {
            const divergence = firstNarrativeDivergence(currentPending.baselineLineage, liveLineage);
            timer = null;
            pending = null;
            sequence += 1;
            try {
                await reconcile({
                    explicitDivergence: divergence >= 0 ? divergence : currentPending.messageId,
                    operation: currentPending.operation,
                    rescan: true,
                    reason: `${currentPending.reason}-settled`,
                    chatKey: currentPending.chatKey,
                });
            } catch (error) {
                onError(error, currentPending);
            }
            return true;
        }

        if (now() - currentPending.startedAt >= timeoutMs) {
            timer = null;
            pending = null;
            sequence += 1;
            onTimeout(currentPending);
            return false;
        }

        timer = setTimer(() => { void poll(token); }, pollMs);
        return false;
    };

    const schedule = (operation, messageId = null, reason = '') => {
        const chatKey = getChatKey();
        if (!chatKey || chatKey === 'no-chat') return false;
        const baselineLineage = pending?.chatKey === chatKey && Array.isArray(pending.baselineLineage)
            ? pending.baselineLineage
            : narrativeLineage(getChat());
        const normalizedOperation = String(operation || '').toLowerCase();
        if (!['delete', 'edit'].includes(normalizedOperation)) return false;
        const priorMessageId = Number.isInteger(pending?.messageId) ? pending.messageId : null;
        const nextMessageId = Number.isInteger(messageId) ? messageId : null;
        const mergedOperation = normalizedOperation === 'delete' || pending?.operation === 'delete' ? 'delete' : 'edit';
        pending = {
            chatKey,
            operation: mergedOperation,
            messageId: priorMessageId !== null && nextMessageId !== null ? Math.min(priorMessageId, nextMessageId) : (priorMessageId ?? nextMessageId),
            reason: mergedOperation === 'delete' ? 'message-deleted' : String(reason || 'message-edited'),
            baselineLineage,
            startedAt: pending?.chatKey === chatKey ? pending.startedAt : now(),
        };
        const token = ++sequence;
        if (timer !== null) clearTimer(timer);
        timer = setTimer(() => { void poll(token); }, 0);
        const probeOptions = {
            explicitDivergence: pending.messageId,
            operation: pending.operation,
            rescan: true,
            reason: `${pending.reason}-probe`,
            chatKey,
        };
        const probePending = pending;
        Promise.resolve().then(() => probe(probeOptions)).then(result => {
            if (token !== sequence || !pending) return;
            if (result?.invalidated === true) cancel();
        }).catch(error => onError(error, probePending));
        return true;
    };

    return Object.freeze({
        schedule,
        cancel,
        pollNow: () => poll(sequence),
        status: () => pending ? {
            pending: true,
            chatKey: pending.chatKey,
            operation: pending.operation,
            messageId: pending.messageId,
            baselineLength: pending.baselineLineage.length,
        } : { pending: false },
    });
}
