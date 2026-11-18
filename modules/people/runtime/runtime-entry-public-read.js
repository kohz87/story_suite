/* NPC State Delta - public scan, portrait, status and diagnostics API (role: runtime-entry-public-read). The first
   half of the public runtime API surface (pageHandles.deltaApi) split from index.js. Built by index.js with the controller closure so every
   method keeps its live bindings; index.js still assigns and freezes the combined object in its original order. */
import { openPortraitTools } from '../portrait/portrait-tools.js';

export function createPublicApiReadPart(deps) {
    const {
        getContext, NPC_STATE_VERSION, scannerRoutingMetrics, scannerDiagnosticLines, chatLineage,
        firstLineageDivergence, narrationCaptureEnabled, getSettings, UI_ID, rt, scanNow, getChatKey,
        pendingAutoScans, cancelScanOperation, processPendingBackfills, ensureFreshMutationBoundary,
        findNpcByIdOrName, scanNpcDossier, refreshNpcFromChat, npcFormName, npcImagePromptPair,
        executeNativePortraitGeneration, openPortraitGenerator, portraitSettingsSnapshot, savePortraitSettingsDraft,
        nsdCardSettings, renderDossier, openNpcEditorSafely, openPersonDossier,
        injectionPreview, chatHydrationStatus, hydrationErrors, isScanBusy, scanOperations,
        narrationCaptureStats, narrationCaptures, getChatState, editorIsMounted,
        hostSwipeState,
        hydratedRevision, hydratedStateMeta, freshnessEvents, hydratedChatKeys, ensureChatStateLoaded,
        ensureHydratedStateFresh, exportBundleBytes, importBundleBytes, reconcileCurrentBranch, diagnosticStore,
    } = deps;

    return {
    version: NPC_STATE_VERSION,
    scan: () => scanNow({ manual: true }),
    cancelScan: () => { const key = getChatKey(); pendingAutoScans.delete(key); return cancelScanOperation(key, 'user cancelled'); },
    scannerRouting: scannerRoutingMetrics,
    // (v2 Diagnostics) The scanner's plain lines for Story Block's report: route, profile, calls, last outcome.
    scannerReport: () => scannerDiagnosticLines({ ctx: getContext(), settings: getSettings(), enabled: !!getSettings().enabled }).concat(
        rt.lastCaptureFallback?.chatKey === getChatKey() ? ['Problems: the reply had no NPC capture; scanned it instead.'] : [],
    ),
    processBackfills: processPendingBackfills,
    scanDossier: async value => {
        const key = getChatKey();
        if (!await ensureFreshMutationBoundary('scan a dossier', key)) return false;
        const npc = findNpcByIdOrName(value);
        return npc ? scanNpcDossier(npc.id) : false;
    },
    refreshFromChat: async value => {
        const key = getChatKey();
        if (!await ensureFreshMutationBoundary('refresh a dossier', key)) return false;
        const npc = findNpcByIdOrName(value);
        return npc ? refreshNpcFromChat(npc.id) : false;
    },
    portraitPrompts: (value, { form = '' } = {}) => {
        const npc = findNpcByIdOrName(value);
        if (!npc) return null;
        const formName = form ? npcFormName(npc, form) : '';
        return npcImagePromptPair(formName ? { ...npc, currentForm: formName, currentFormUnknown: false } : npc);
    },
    formPortraits: value => {
        const npc = findNpcByIdOrName(value);
        const forms = npc ? getChatState().formPortraitAssets?.[npc.id] || {} : {};
        return Object.fromEntries(Object.values(forms).filter(portrait => portrait?.dataUrl).map(portrait => [portrait.form, structuredClone(portrait)]));
    },
    generatePortraitUrl: async (value, overrides = {}) => {
        const npc = findNpcByIdOrName(value);
        if (!npc) return null;
        const prompts = npcImagePromptPair(npc);
        return executeNativePortraitGeneration(
            String(overrides?.positive ?? prompts.positive).trim(),
            String(overrides?.negative ?? prompts.negative).trim(),
            overrides?.seed !== undefined ? overrides.seed : npc.portraitSeed,
        );
    },
    openPortraitGenerator: value => { const npc = findNpcByIdOrName(value); return npc ? openPortraitGenerator(npc.id) : false; },
    // The portrait manager (view, upload, generate, remove) for one person by id, name or alias: the view's dossier ⋯ › Portrait opens it.
    openPortraitTools: value => { const npc = findNpcByIdOrName(value); return npc ? Boolean(openPortraitTools(npc.id)) : false; },
    portraitSettings: () => portraitSettingsSnapshot(getSettings()),
    portraitSettingsDirty: () => rt.portraitSettingsDirty,
    savePortraitSettings: draft => savePortraitSettingsDraft(draft),
    /** What a character card may recommend (the definition Story Block 2.21.0 registers as card settings). */
    cardSettings: () => nsdCardSettings(),
    render: renderDossier,
    openEditor: value => { const npc = findNpcByIdOrName(value); return npc ? openNpcEditorSafely(npc.id) : false; },
    openDossier: value => { const npc = findNpcByIdOrName(value); return npc ? openPersonDossier(npc.id) : false; },
    injectionPreview: () => structuredClone(injectionPreview()),
    isEnabled: () => getSettings().enabled !== false,
    uiStatus: () => ({
        version: NPC_STATE_VERSION,
        chatKey: getChatKey(),
        hydrationStatus: chatHydrationStatus(getChatKey()),
        hydrationError: hydrationErrors.get(getChatKey())?.message || null,
        scanBusyForChat: isScanBusy(getChatKey()),
        scanOperation: scanOperations.status(getChatKey()),
        scannerRouting: scannerRoutingMetrics(),
        narrationCapture: { ...narrationCaptureStats, enabled: narrationCaptureEnabled(), armed: Boolean(rt.narrationCaptureArmed), pending: narrationCaptures.size },
        settingsPanelMounted: Boolean(document.querySelector?.(`#${UI_ID}`)),
        rosterMounted: Boolean(document.querySelector?.('#npc_state_delta_roster_summary')),
        editorMounted: editorIsMounted(),
        editorMode: rt.activeEditorPopup ? 'sillytavern-popup' : 'closed',
        portraitGeneratorOpen: Boolean(rt.activePortraitGeneratorOverlay),
        portraitGeneratorNpcId: rt.activePortraitGeneratorNpcId || null,
        portraitGenerationBusy: rt.portraitGenerationBusy,
        lastScan: rt.lastScanMetrics ? { ...rt.lastScanMetrics } : null,
        swipeState: hostSwipeState(),
        swipeSettlementPending: Boolean(rt.swipeSettlementPending || rt.swipeSettlementTimer),
        hydratedRevision: hydratedRevision(getChatKey()),
        latestObservedServerRevision: hydratedStateMeta.get(getChatKey())?.latestObservedServerRevision ?? null,
        freshnessLastCheckedAt: hydratedStateMeta.get(getChatKey())?.lastCheckedAt || null,
        freshnessEvents: freshnessEvents
            .filter(event => event.chatKey === getChatKey())
            .slice(-8)
            .map(event => structuredClone(event)),
    }),
    ensureFresh: async (options = {}) => {
        const key = getChatKey();
        if (!key || key === 'no-chat') return false;
        if (!hydratedChatKeys.has(key)) await ensureChatStateLoaded(key, { probeMissing: true });
        else await ensureHydratedStateFresh(key, { reason: String(options?.reason || 'public-freshness-check'), notify: options?.notify === true, probeMissing: true });
        return getChatKey() === key;
    },
    exportBytes: async ({ chatKey = '' } = {}) => {
        const key = getChatKey();
        if (chatKey && chatKey !== key) throw new Error('The active chat changed before export; nothing was exported.');
        if (!await ensureFreshMutationBoundary('export a dossier', key, { notify: false })) throw new Error('NPC State Delta canonical server dossier is unavailable.');
        if (getChatKey() !== key) throw new Error('The active chat changed before export; nothing was exported.');
        return exportBundleBytes();
    },
    importBytes: async bytes => {
        const key = getChatKey();
        if (!await ensureFreshMutationBoundary('import a dossier', key)) return false;
        return importBundleBytes(bytes);
    },
    reconcile: (options = {}) => reconcileCurrentBranch({ ...options, explicit: true }),
    scanMetrics: () => rt.lastScanMetrics ? { ...rt.lastScanMetrics } : null,
    diagnosticsSummary: () => diagnosticStore.summary(getChatKey()),
    diagnosticsRecords: options => diagnosticStore.records(getChatKey(), options || {}),
    diagnosticsForNpc: npcId => diagnosticStore.records(getChatKey(), { npcId: String(npcId || '') }),
    diagnosticBundle: () => {
        const key = getChatKey();
        const bundle = diagnosticStore.bundle(key, { applicationVersion: NPC_STATE_VERSION });
        // The chat's shape carries counts and message numbers only: no story text and no chat key.
        const chatMessages = getContext().chat || [];
        bundle.branch = {
            chat: key === 'no-chat' ? null : {
                messages: chatMessages.length,
                hiddenOrSystemMessages: chatMessages.filter(message => message?.is_system).length,
                storedLineageDivergence: firstLineageDivergence(getChatState(key)?.lineage || [], chatLineage(chatMessages)),
                turn: Number(getChatState(key)?.turn || 0),
            },
        };
        // Session counters only; the instruction and blocks themselves are never exported.
        bundle.narrationCapture = { ...narrationCaptureStats, enabled: narrationCaptureEnabled(), pending: narrationCaptures.size };
        return bundle;
    },
    clearDiagnostics: () => diagnosticStore.clear(getChatKey()),
    getState: () => structuredClone(getChatState()),
    // The fingerprints of the open chat's messages now (the timeline participant asks it of a head selection that would install an older state).
    chatLineage: () => chatLineage(getContext().chat || []),
    // The reader's "Scan every" (the timeline participant sizes what a quiet stretch can be from it).
    scanEvery: () => getSettings().scanEvery,
    };
}
