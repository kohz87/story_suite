import { getContext } from '../../../../../../extensions.js';
import { createDestructiveSettlementController } from './destructive-settlement-core.js';
import { pageHandles } from '../runtime/handles.js';

const REGISTRY_KEY = '__NPCStateDeltaDestructiveSettlement';

function npcStateDeltaApi() {
    return pageHandles.deltaApi;
}

// (perf) Both read directly, never through uiStatus(): that builds the branch-history diagnostics (a serialised copy of the state) on each call.
function activeChatKey() {
    return String(npcStateDeltaApi()?.chatKey?.() || 'no-chat');
}

// SillyTavern's swipe state, read as runtime-branch.js hostSwipeState reads it.
function hostSwipeActive() {
    try {
        const state = getContext().swipe?.state?.();
        return typeof state === 'string' && state !== '' && state !== 'none';
    } catch {
        return false;
    }
}

function buildController() {
    const reconcile = options => {
        const api = npcStateDeltaApi();
        if (!api?.reconcile) throw new Error('NPC State Delta reconcile API is unavailable.');
        return api.reconcile(options);
    };
    return createDestructiveSettlementController({
        getChat: () => getContext().chat || [],
        getChatKey: activeChatKey,
        isSwipeActive: hostSwipeActive,
        reconcile,
        probe: reconcile,
        // (perf) One look, on the next tick, then the wait ends. SillyTavern sends MESSAGE_EDITED and MESSAGE_DELETED after it has changed
        // the chat, so the baseline already holds the change and a longer wait never settled: it polled for 5 s and timed out on every
        // edit and delete. Each event is still read again by the probe reconcile here and by the queued branch reconcile
        // (runtime-entry-events.js). A second edit or delete before that tick still settles against the first one's baseline.
        timeoutMs: 0,
        onError: error => {
            console.warn('[NPC State Delta] settled destructive branch reconciliation failed', error);
        },
    });
}

function registerDestructiveSettlement() {
    if (globalThis[REGISTRY_KEY]?.controller) return globalThis[REGISTRY_KEY].controller;
    const ctx = getContext();
    const events = ctx.eventTypes || ctx.event_types || {};
    const source = ctx.eventSource;
    const controller = buildController();

    if (source?.on) {
        if (events.MESSAGE_DELETED) {
            source.on(events.MESSAGE_DELETED, messageId => {
                controller.schedule('delete', Number.isInteger(messageId) ? messageId : null, 'message-deleted');
            });
        }
        if (events.MESSAGE_EDITED) {
            source.on(events.MESSAGE_EDITED, messageId => {
                controller.schedule('edit', Number.isInteger(messageId) ? messageId : null, 'message-edited');
            });
        }
        if (events.CHAT_CHANGED) source.on(events.CHAT_CHANGED, () => controller.cancel());
    }

    globalThis[REGISTRY_KEY] = Object.freeze({
        controller,
        status: () => controller.status(),
    });
    return controller;
}

registerDestructiveSettlement();
