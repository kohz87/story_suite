/* NPC State Delta supporting tools: the one tools overlay and its session (open, replace, close). */
import { recordToolEvent } from './events.js';
import { overlayMountHost } from './host-api.js';

const OVERLAY_ID = 'npc_state_delta_tools_overlay';

export let activeOverlay = null;
export let activeSession = null;
function invalidateSession(reason = 'closed') {
    if (activeSession) {
        activeSession.cancelled = true;
        activeSession.actionSeq += 1;
        recordToolEvent('workflow-closed', { chatKey: activeSession.chatKey, npcId: activeSession.npcId, action: activeSession.kind, detail: reason });
    }
}

function restoreFocus(session) {
    try { session?.returnFocus?.focus?.({ preventScroll: true }); } catch {}
}

export function closeOverlay({ reason = 'closed', restore = true, session: expectedSession = null } = {}) {
    if (expectedSession && activeSession !== expectedSession) return false;
    const session = activeSession;
    invalidateSession(reason);
    try {
        if (activeOverlay?.tagName === 'DIALOG' && activeOverlay.open && typeof activeOverlay.close === 'function') activeOverlay.close();
    } catch {}
    activeOverlay?.remove?.();
    activeOverlay = null;
    activeSession = null;
    document.documentElement?.classList?.remove?.('npc-state-delta-tools-open');
    document.body?.classList?.remove?.('npc-state-delta-tools-open');
    if (restore) restoreFocus(session);
}
export function mountOverlay(html, session) {
    closeOverlay({ reason: 'replaced', restore: false });
    const overlay = document.createElement('dialog');
    overlay.id = OVERLAY_ID;
    overlay.className = 'npc-state-delta-tools-overlay';
    overlay.innerHTML = html;
    overlay.addEventListener('click', event => {
        if (event.target === overlay && (!session.busy || session.cancelableBusy)) closeOverlay({ reason: 'backdrop' });
        const close = event.target.closest?.('[data-delta-tools-close]');
        if (close && (!session.busy || session.cancelableBusy)) {
            event.preventDefault();
            closeOverlay({ reason: 'cancelled' });
        }
    });
    overlay.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        // The top dialog owns Escape, not an underlying dossier or host popup.
        event.stopPropagation();
        if (overlay.dataset.deltaOverlayMode === 'fixed-fallback') {
            event.preventDefault();
            if (!session.busy || session.cancelableBusy) closeOverlay({ reason: 'escape', session });
        }
    });
    overlay.addEventListener('cancel', event => {
        event.preventDefault();
        if (!session.busy || session.cancelableBusy) closeOverlay({ reason: 'escape' });
    });
    const host = overlayMountHost();
    if (!host) throw new Error('NPC State Delta could not find a safe host for the supporting-tools overlay.');
    host.appendChild(overlay);
    activeOverlay = overlay;
    activeSession = session;
    try {
        if (typeof overlay.showModal === 'function') {
            overlay.showModal();
            overlay.dataset.deltaOverlayMode = 'top-layer-dialog';
        } else {
            overlay.setAttribute('open', '');
            overlay.dataset.deltaOverlayMode = 'fixed-fallback';
        }
    } catch (error) {
        activeOverlay = null;
        activeSession = null;
        overlay.remove();
        throw error;
    }
    document.documentElement?.classList?.add?.('npc-state-delta-tools-open');
    document.body?.classList?.add?.('npc-state-delta-tools-open');
    requestAnimationFrame(() => overlay.querySelector('[data-delta-tools-autofocus], [data-delta-tools-close]')?.focus?.());
    recordToolEvent('workflow-opened', { chatKey: session.chatKey, npcId: session.npcId, action: session.kind });
    return overlay;
}
