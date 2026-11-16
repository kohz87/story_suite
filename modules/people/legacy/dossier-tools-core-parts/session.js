/* NPC State Delta supporting tools: workflow sessions (make one, tell if it is still current, busy state, target guard). */
import { plain } from './values.js';
import { activeChatKey, npcById } from './host-chat.js';
import { activeOverlay, activeSession } from './overlay.js';

let sessionSequence = 0;

export function portraitTargetCurrent({
    expectedChatKey = '', actualChatKey = '', npcId = '', npcExists = false,
    sessionId = null, activeSessionId = null, actionSeq = null, expectedActionSeq = null, cancelled = false,
} = {}) {
    if (cancelled || !expectedChatKey || expectedChatKey !== actualChatKey || !npcId || !npcExists) return false;
    if (sessionId !== null && activeSessionId !== null && sessionId !== activeSessionId) return false;
    if (expectedActionSeq !== null && actionSeq !== null && actionSeq !== expectedActionSeq) return false;
    return true;
}

export function currentSessionIs(session) {
    return Boolean(session && activeSession === session && activeOverlay?.isConnected && portraitTargetCurrent({
        expectedChatKey: session.chatKey,
        actualChatKey: activeChatKey(),
        npcId: session.kind === 'portrait' ? session.npcId : 'workflow',
        npcExists: session.kind !== 'portrait' || Boolean(npcById(session.npcId)),
        sessionId: session.id,
        activeSessionId: activeSession?.id ?? null,
        cancelled: session.cancelled,
    }));
}
export function makeSession(kind, values = {}) {
    return {
        id: ++sessionSequence,
        kind,
        chatKey: activeChatKey(),
        npcId: plain(values.npcId),
        returnFocus: document.activeElement,
        actionSeq: 0,
        busy: false,
        cancelableBusy: false,
        cancelled: false,
        importBytes: null,
        importDecoded: null,
        importSummary: null,
    };
}
export function setBusy(session, busy, status = '', { allowClose = false } = {}) {
    if (!currentSessionIs(session)) return;
    const nextBusy = Boolean(busy);
    const wasBusy = Boolean(session.busy);
    const controls = activeOverlay?.querySelectorAll?.('[data-delta-tools-close], button, input[type="file"]') || [];
    if (nextBusy && !wasBusy) {
        controls.forEach?.(control => {
            if (control.dataset?.deltaToolsAllowBusy === '1' || (allowClose && control.matches?.('[data-delta-tools-close]'))) return;
            control.dataset.deltaToolsBusyPrevDisabled = control.disabled ? '1' : '0';
            control.disabled = true;
        });
    } else if (!nextBusy && wasBusy) {
        controls.forEach?.(control => {
            if (control.dataset?.deltaToolsAllowBusy === '1') return;
            control.disabled = control.dataset.deltaToolsBusyPrevDisabled === '1';
            delete control.dataset.deltaToolsBusyPrevDisabled;
        });
    }
    session.busy = nextBusy;
    session.cancelableBusy = nextBusy && allowClose;
    const statusNode = activeOverlay?.querySelector?.('[data-delta-tools-status]');
    if (statusNode) {
        statusNode.textContent = status;
        statusNode.hidden = !status;
    }
}
