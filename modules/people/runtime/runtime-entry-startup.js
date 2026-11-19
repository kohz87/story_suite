/* NPC State - runtime startup (role: runtime-entry-startup). The idempotent init/safeInit functions split from
   runtime-entry.js. Built by runtime-entry.js with the controller closure; the DOM-ready and lifecycle registrations stay in runtime-entry.js.
   The optional adapter import keeps its root-relative ./src/ path and its position in initialization. */

import { rpgIsOn } from '../settings/runtime-settings.js';

export function createStartup(rt, deps) {
    const {
        getSettings, clearLegacyPromptKeys, watchHost, SUITE_API, UI_ID, NPC_STATE_VERSION,
        latestReplyIndex, castSync, castPortraitDue, nsdCardSettings, setStoryClockSource, setStoryDateAtSource, setStoryDayAtSource, hostedStoryDateAt, hostedStoryDayAt,
        hostedStoryClock, bindUi, installUiCaptureBridge, registerEvents,
        flushCurrentChatOnPageHide, refreshCurrentChatFromServer, scheduleSettingsMountRetries, getChatKey,
        isCanonicalChatKey, ensureChatStateLoaded, decideBranch, seedBranchTracking, getChatState,
        renderDossier, updateInjection, evictDormantChatStates,
    } = deps;

    async function init() {
        if (rt.initialized) {
            scheduleSettingsMountRetries();
            return;
        }
        rt.initialized = true;
        getSettings();
        clearLegacyPromptKeys();
        watchHost();
        // Story Suite v2 (Story Block 2): optional; without a v2 host the adapter does nothing.
        import('../storysuite-v2.js').then(v2 => { rt.peopleAdapter = v2.startPeopleAdapter({ suiteApi: SUITE_API, panelId: UI_ID, version: NPC_STATE_VERSION, headReply: latestReplyIndex, castSync, castPortraitDue, cardSettings: nsdCardSettings(), linesMode: () => true, levelOn: () => rpgIsOn() }); }).catch(error => console.debug('[NPC State] Story Suite v2 adapter is not available', error));
        // (v2) Hosted with Story Director, the story's date follows its clock (calendar.js hostedStoryDate). No host: none.
        setStoryClockSource(hostedStoryClock);
        setStoryDateAtSource(hostedStoryDateAt);
        setStoryDayAtSource(hostedStoryDayAt);
        bindUi();
        installUiCaptureBridge();
        registerEvents();
        globalThis.addEventListener?.('pagehide', flushCurrentChatOnPageHide);
        globalThis.addEventListener?.('pageshow', () => { void refreshCurrentChatFromServer('pageshow'); });
        globalThis.document?.addEventListener?.('visibilitychange', () => {
            if (globalThis.document?.visibilityState === 'hidden') flushCurrentChatOnPageHide();
            else if (globalThis.document?.visibilityState === 'visible') void refreshCurrentChatFromServer('visibility-resume');
        });
        scheduleSettingsMountRetries();

        let key = getChatKey();
        try {
            if (isCanonicalChatKey(key)) {
                await ensureChatStateLoaded(key);
                if (getChatKey() !== key) return;
                decideBranch(key);
                seedBranchTracking(getChatState(key));
            }
        } catch (error) {
            console.error('[NPC State] startup hydration failed; extension remains mounted in read-only recovery mode.', error);
            if (getChatKey() === key) renderDossier();
        }
        updateInjection();
        evictDormantChatStates(getChatKey());
        console.log(`[NPC State] v${NPC_STATE_VERSION} loaded`);
    }

    async function safeInit() {
        try {
            await init();
        } catch (error) {
            rt.initialized = false;
            console.error('[NPC State] initialization failed', error);
        }
    }

    return { init, safeInit };
}
