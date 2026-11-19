/* NPC State Delta cast refresh: after a reply renders, a message changes or the chat loads, tells the
   Cast and World panes (and the timeline) that the dossiers may have changed, once, after a short wait.
   Nothing is drawn in the chat itself. Timers stay per module instance. */

export function createCastRefreshPart(deps) {
    const { chatHydrationStatus, getChatKey } = deps;
    let timer = null;

    function announceCastRendered() {
        let chatKey;
        try { chatKey = getChatKey(); } catch { return; }
        if (chatKey === 'no-chat' || chatHydrationStatus(chatKey) !== 'ready') return;
        document.dispatchEvent?.(new CustomEvent('npc-state-delta:cast-rendered', { detail: { streaming: false } }));
    }

    function queueCastRefresh(delay = 0) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            try { announceCastRendered(); } catch (error) { console.warn('[NPC State Delta] cast refresh failed', error); }
        }, Math.max(0, Number(delay) || 0));
    }

    return { queueCastRefresh, announceCastRendered };
}
