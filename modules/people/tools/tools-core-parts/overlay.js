/* NPC State supporting tools: the one tools overlay and its session (open, replace, close). */
import { recordToolEvent } from './events.js';
import { overlayMountHost } from './host-api.js';

const OVERLAY_ID = 'people_tools_overlay';

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
    document.documentElement?.classList?.remove?.('ppl-tools-open');
    document.body?.classList?.remove?.('ppl-tools-open');
    if (restore) restoreFocus(session);
}
// The dialog sits on <body>, outside the Story Suite view that holds the theme: it takes the view's --su-* values so it is glass in the same look (dark or light).
function carryTheme(overlay) {
    const style = document.querySelector?.('.su-root')?.style;
    for (let i = 0; style && i < style.length; i += 1) if (style[i].startsWith('--su-')) overlay.style.setProperty(style[i], style.getPropertyValue(style[i]));
}
export function mountOverlay(html, session) {
    closeOverlay({ reason: 'replaced', restore: false });
    const overlay = document.createElement('dialog');
    overlay.id = OVERLAY_ID;
    overlay.className = 'ppl-tools-overlay';
    overlay.innerHTML = html;
    carryTheme(overlay);
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
    if (!host) throw new Error('NPC State could not find a safe host for the supporting-tools overlay.');
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
    document.documentElement?.classList?.add?.('ppl-tools-open');
    document.body?.classList?.add?.('ppl-tools-open');
    requestAnimationFrame(() => overlay.querySelector('[data-delta-tools-autofocus], [data-delta-tools-close]')?.focus?.());
    recordToolEvent('workflow-opened', { chatKey: session.chatKey, npcId: session.npcId, action: session.kind });
    return overlay;
}
