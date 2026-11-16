// Story Block v2's page furniture in SillyTavern (index.js calls mountUi once): everything a reader
// clicks that is not a module's own screen.
//
// * The Story Suite bar, just above the message box: Story (the tab panel), Game view (when a module
//   offers full-screen screens; Alt+G opens and closes it too, MODULES §F53), Settings (the Story Suite
//   overlay), and the notice a canGenerate hook leaves when it held a reply back (MODULES §F12).
// * The status strip (the `hud` mount) above the message box: Story Block's feature `story-block.hud`, on
//   unless the reader turned it off (Settings → Features, or the drawer's switch; MODULES §F54, §F100). The
//   cards under replies are the feature `story-block.cards` (each card screen keeps its own switch too).
// * Features (MODULES §F100): screens, tabs and widgets under a feature the reader turned off are hidden,
//   whoever restyled them (a pack, the card, the reader); turning one on or off redraws what it touches.
// * The notes under replies (src/v2/reply-notes.js, MODULES §F40): a reply that came without change lines, a reply edited since,
//   each with Re-read when the runtime offers one. The changes card gets the reply's refused lines as `refused` (§F41).
// * Choices under replies (src/v2/extras-ui.js, MODULES §F115): the latest reply's choices as buttons that only fill the message
//   box. Inner chatter is not drawn under replies (World → Now or Scene shows it).
// * The tab panel: the tab host (src/v2/host-ui.js) with every module tab and every `tab` screen, a side sheet on wide screens and a
//   bottom sheet on phones. Redrawn from the head on every change.
// * The reader's tab order (src/v2/view/tab-order.js, Settings → Tabs & Packs → Tabs): one list for the panel's tabs and the game
//   view's screens, Up/Down, Shown, Reset to default; Home is always first and shown.
// * The Story Block drawer in Extensions: version, modules, the same buttons.
// * Settings → Diagnostics (src/v2/diagnostics.js): a report to copy or save, made from the runtime's parts and each module's
//   `hooks.diagnostics`; console errors are caught for it. And "Show the UI sample" (src/v2/screens/ui-sample.js).
// * The look (src/v2/view/theme.js): the theme bridge writes Story Suite's tokens (light or dark from SillyTavern's theme,
//   Settings → Story Suite → Panel style and Font) for every Story Suite root.
// * The wand menu: Story Suite (the overlay). The overlay's prompt size counts what the next reply would
//   be sent (turn.preview) with SillyTavern's tokenizer when there is one; `openSettings({ fold })` opens
//   it at one fold (Home's "Import a pack" → the Packs fold, while no pack is installed).
// * The five mounts (SPEC §13.4) over the screen registry, drawn by the layout renderer (and the template renderer when it is in this
//   checkout), with the standard and module widgets, and the host's own two that need the store and the chat: `story-block.inspector`
//   (MODULES §F92; feature off by default) and `story-block.savepoints` (the save points on Home, §F93; feature on).
// * The parts of mountUi that stand alone are in src/v2/ui-host/ (inspector-problems, card-offer-wiring, lean-rpg-sync, drawer, host-api, notes-wiring).
//
// Every text is set with textContent; nothing a module or a pack wrote becomes markup here. The texts are
// in src/v2/strings.js.

import { HOME_SCREEN_ID } from './screens/index.js';
import { createReplyExtras } from './extras-ui.js';
import { displayLines } from './extras.js';
import { fill } from './strings.js';
import { CORE_FEATURE } from './features.js';
import { renderCardOffers } from './packs/card-offer-ui.js';
import { readCharacterLorebook, saveSettingsNow } from './packs/st-adapter.js';
import { createReplyCards } from './ui-host/replies.js';
import { inspectorProblemsFor } from './ui-host/inspector-problems.js';
import { createCardOfferWiring } from './ui-host/card-offer-wiring.js';
import { createHostApi } from './ui-host/host-api.js';
import { createNotesWiring } from './ui-host/notes-wiring.js';
import { createDrawerUi } from './ui-host/drawer.js';
import { createLeanRpgSync } from './ui-host/lean-rpg-sync.js';
import { createUiMounts } from './ui-host/mounts.js';
import { createUiNavigation } from './ui-host/navigation.js';
import { createUiSettings } from './ui-host/settings.js';
import { installUiEvents, createHold } from './ui-host/events.js';
import { createUiPanel } from './ui-host/panel.js';
import { createSendNote } from './ui-host/send-note.js';
import { createHostSetup } from './ui-host/setup.js';
import { createScreenSync } from './ui-host/screens.js';
import { IDS, el, iconButton, S, isGameViewKey, hasReplyRecord, hudOn } from './ui-host/shared.js';
export { isGameViewKey, hasReplyRecord, hudOn } from './ui-host/shared.js';

/**
 * mountUi({ runtime, ctx, doc?, version?, loadLeanRpg? }) → { refresh(), blocked(reason, moduleId), clearBlocked(),
 * openPanel(), closePanel(), openSettings(), toggleGameView(), setHud(on), hudOn(), screens, mounts,
 * renderer, notes, extras, savePoints, inspector, tabs (Settings → Tabs: rows(), move(id, delta),
 * setHidden(id, hidden), reset(), isDefault()), syncScreens(), destroy() }.
 * Re-read uses `sdk.reread(index)` (or `runtime.turn.reread(index)`) when the runtime has one.
 */
export function mountUi({ runtime, ctx, doc = globalThis.document, version = '', loadLeanRpg = () => import('./lean-rpg/view/index.js'), readLorebook = readCharacterLorebook, flushSettings = saveSettingsNow }) {
    const { registry, store, sdk, settings, events } = runtime;
    const { queryAt, widgets, coreOn, blockTemplates, blockWidgets, liveCtx, savePoints, inspector, hostWidgets, renderer,
        screens, tabOrder, extraTabs, navPresent, barDeclared, setSharedTabs } = createHostSetup({
        runtime, ctx, doc, registry, store, sdk, openSettings, inspectorProblems, getRpg: () => leanRpg.getRpg(), openScreen: id => mounts?.screen?.open?.(id) ?? false,
    });
    const { rpgOn, blockPresentation, syncScreens } = createScreenSync({ doc, registry, sdk, screens, setSharedTabs });

    const redrawHold = createHold();
    const api = createHostApi({ sdk, redrawHold, getMounts: () => mounts });
    const carriers = () => (ctx.chat ?? []).map((message, index) => (message && !message.is_user ? index : -1)).filter(index => index >= 0);
    // Cards go under replies with a story record of their own; never under the greeting (every message
    // before the reader's first one), which holds the chat's start, not a reply's changes.
    const hasCard = index => hasReplyRecord(ctx.chat ?? [], index);
    // ---- notes under replies, and the refused lines the changes card shows (ui-host/notes-wiring.js) ----
    const notes = createNotesWiring({ runtime, ctx, doc, sdk, events, getMounts: () => mounts });
    // Choices under the latest reply (MODULES §F115), read from its own text.
    const extras = createReplyExtras({
        ctx,
        doc,
        events,
        display: typeof runtime.display === 'function' ? runtime.display : mes => displayLines(mes, { entryOf: word => registry.capture(word) }),
        featureOn: id => registry.featureOn?.(id) === true,
    });
    // What the Inspector lists as a reply's problems (ui-host/inspector-problems.js).
    function inspectorProblems(index) { return inspectorProblemsFor(index, { store, runtime, notes }); }
    // The RPG's screens (ui-host/lean-rpg-sync.js): loaded by import() only while its feature is on, taken away when it goes off.
    const leanRpg = createLeanRpgSync({
        loadLeanRpg, doc, ctx, store, events, screens, hostWidgets, registry, runtime, liveCtx, settings, sdk, api, rpgOn,
        getHeadState: () => headStateNow, getMounts: () => mounts, getOverlay: () => overlay, refresh: () => refresh(), openSettings: options => openSettings(options),
    });
    const { syncLeanRpg } = leanRpg;
    const { cardLines, assistedAt, branchNow, replyCardsAt, replyOffs } = createReplyCards({
        runtime, ctx, doc, store, registry, events, queryAt, renderer, notes, screens, api, getRpg: () => leanRpg.getRpg(), getMounts: () => mounts,
    });
    const mounts = createUiMounts({
        screens, renderer, registry, ctx, store, sdk, queryAt, notes, assistedAt, cardLines, replyCardsAt, branchNow, coreOn,
        api, events, carriers, hasCard, tabOrder, navPresent, barDeclared, extraTabs, doc, getRpg: () => leanRpg.getRpg(),
    });
    runtime.setDialog?.((screenId, opts) => mounts.dialog.open(screenId, opts), () => mounts.dialog.current?.() ?? null);
    const { headStateNow, tabSource, tabsControl } = createUiNavigation({
        registry, extraTabs, store, queryAt, screens, tabOrder, navPresent, barDeclared, mounts,
        getPanel: () => panel, getTabHost: () => tabHost,
    });

    let tabHost = null;
    const { panel, offerBox, openPanel, closePanel } = createUiPanel({
        doc, sdk, tabSource, tabOrder, barDeclared, mounts, getTabHost: () => tabHost, setTabHost: value => { tabHost = value; },
    });

    let overlay = null;
    const settingsUi = createUiSettings({
        runtime, doc, registry, store, sdk, settings, version, widgets, liveCtx, tabsControl, blockTemplates, blockWidgets,
        getRpg: () => leanRpg.getRpg(), getHudAsked: () => hudAsked(), getCardLog: () => cardLog,
        getOverlay: () => overlay, setOverlay: value => { overlay = value; },
    });
    const { theme } = settingsUi;
    function openSettings(options = null) { return settingsUi.openSettings(options); }

    // ---- the bar above the message box ------------------------------------------------------
    const bar = el(doc, 'div', 'story-suite-bar');
    bar.id = IDS.bar;
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', S.bar.label);
    const storyButton = iconButton(doc, 'story-suite-bar-story', 'fa-book-open', S.bar.story, S.bar.storyTitle);
    const gameButton = iconButton(doc, 'story-suite-bar-game', 'fa-expand', S.bar.game, S.bar.gameTitle);
    gameButton.setAttribute('aria-keyshortcuts', 'Alt+G');
    const settingsButton = iconButton(doc, 'story-suite-bar-settings', 'fa-sliders', S.bar.suite, S.bar.suiteTitle);
    // The dot on the Story button while a card offer waits for an answer (the app's own alert dot, view/mounts-*.css).
    const offerDot = el(doc, 'span', 'ss-screenbar-alert ss-card-offer-dot');
    offerDot.hidden = true;
    storyButton.appendChild(offerDot);
    const cardLog = [];
    const cardOffer = createCardOfferWiring({ runtime, ctx, sdk, store, liveCtx, readLorebook, flushSettings, cardLog });
    const showDot = () => {
        const waiting = cardOffer?.waiting() === true;
        offerDot.hidden = !waiting;
        storyButton.setAttribute('aria-label', waiting ? S.bar.storyOffer : S.bar.storyTitle);
        storyButton.title = waiting ? S.bar.storyOffer : S.bar.storyTitle;
    };
    const offerView = cardOffer ? renderCardOffers(offerBox, cardOffer, { doc }) : null;
    const offs0 = [];
    if (cardOffer) {
        offs0.push(cardOffer.subscribe(showDot));
        // A module or extension that registers after the chat opened changes what is missing; the notices are drawn again.
        offs0.push(runtime.cardSettings.subscribe(() => offerView.refresh()));
        offs0.push(events.on('modules', () => offerView.refresh()));
    }
    const notice = el(doc, 'div', 'story-suite-notice');
    notice.setAttribute('role', 'status');
    notice.hidden = true;
    const noticeText = el(doc, 'span', 'story-suite-notice-text');
    const noticeClose = iconButton(doc, 'story-suite-notice-close', 'fa-xmark', '', S.bar.dismiss);
    notice.append(noticeText, noticeClose);
    bar.append(storyButton, gameButton, settingsButton, notice);
    // SillyTavern's keyboard handler clicks a focused menu_button on Enter, and the browser's own Enter activation clicks it again:
    // one press, two clicks (the Story toggle opened and closed). The browser's activation is cancelled for the bar's buttons;
    // the handler's click is the one that counts (Space is one click already: it activates on the key's release).
    for (const node of [storyButton, gameButton, settingsButton]) node.addEventListener('keypress', event => { if (event.key === 'Enter') event.preventDefault(); });
    storyButton.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
    gameButton.addEventListener('click', () => mounts.screen.open(HOME_SCREEN_ID));
    settingsButton.addEventListener('click', () => openSettings());
    noticeClose.addEventListener('click', () => clearBlocked());

    // Alt+G: the game view, open or closed (MODULES §F53). The bar button stays the visible way in.
    function toggleGameView() {
        if (mounts.screen.isOpen()) {
            mounts.screen.close();
            return false;
        }
        return mounts.screen.open(HOME_SCREEN_ID);
    }
    const onKey = event => {
        if (!isGameViewKey(event) || event.repeat) return;
        if (!mounts.screen.isOpen() && screens.list('screen').length === 0) return;
        event.preventDefault?.();
        event.stopPropagation?.();
        toggleGameView();
    };
    doc.addEventListener?.('keydown', onKey);
    const placeBar = () => {
        const anchor = doc.querySelector('#send_form');
        if (anchor?.parentNode && bar.nextElementSibling !== anchor && bar.parentNode !== anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
        else if (!bar.parentNode) doc.body.appendChild(bar);
    };
    placeBar();
    const sendNote = createSendNote({ doc, ctx, enabled: () => settings().sendPending !== false, busy: () => runtime.turn?.replyBusy?.() === true, held: () => leanRpg.getRpg()?.sendHeld?.() === true, openBoard: () => leanRpg.getRpg()?.openHeldFight?.() === true });

    // ---- the Extensions drawer and the wand menu (ui-host/drawer.js) ------------------------
    const { drawer, menu, drawerStatus, hudAsked, syncHud } = createDrawerUi({ doc, ctx, screens, openSettings, openPanel, setHud });
    drawer();
    menu();

    // ---- the canGenerate notice ------------------------------------------------------------
    let blockedBy = null;
    function blocked(reason, moduleId) {
        blockedBy = moduleId ?? null;
        const name = registry.module(moduleId)?.name ?? moduleId ?? S.bar.label;
        noticeText.textContent = fill(S.bar.blocked, { module: name, reason });
        notice.hidden = false;
        bar.classList.add('story-suite-bar-blocked');
    }
    function clearBlocked() {
        blockedBy = null;
        notice.hidden = true;
        noticeText.textContent = '';
        bar.classList.remove('story-suite-bar-blocked');
    }

    // ---- keeping it all current -------------------------------------------------------------
    function refresh() {
        placeBar();
        drawer();
        menu();
        const modules = sdk.modules();
        drawerStatus.textContent = fill(S.drawer.status, { version, modules: modules.map(module => module.name).join(', ') });
        gameButton.hidden = screens.list('screen').length === 0;
        mounts.tab.register();
        if (!panel.hidden) tabHost?.refresh();
        if (hudOn(ctx.extensionSettings)) mounts.hud.show();
        else mounts.hud.hide();
        syncHud();
        mounts.screen.update();
        notes.refreshAll();
        extras.refreshAll();
    }

    /**
     * Turns the status strip on or off and keeps the choice: the feature `story-block.hud`, and the old
     * `storySuite.hud` switch with it (so an older Story Block reads the same choice).
     */
    function setHud(on) {
        const es = ctx.extensionSettings ?? {};
        if (!es.storySuite || typeof es.storySuite !== 'object') es.storySuite = {};
        es.storySuite.hud = Boolean(on);
        if (runtime.features?.set?.(CORE_FEATURE.hud, Boolean(on)) === undefined) {
            if (!es.storySuite.features || typeof es.storySuite.features !== 'object') es.storySuite.features = {};
            es.storySuite.features[CORE_FEATURE.hud] = Boolean(on);
            ctx.saveSettingsDebounced?.();
        }
        refresh();
        return Boolean(on);
    }
    const offs = installUiEvents({
        replyOffs, offs0, registry, store, events, ctx, runtime, mounts, screens, blockWidgets, cardOffer,
        blockPresentation, syncScreens, syncLeanRpg, refresh, clearBlocked, getPanel: () => panel,
        getTabHost: () => tabHost, getOverlay: () => overlay, getBlockedBy: () => blockedBy, redrawHold,
    });

    syncScreens();
    syncLeanRpg();
    refresh();
    mounts.card?.attachAll?.();
    cardOffer?.refresh().catch(error => console.warn('[Story Suite] the card offer could not be read', error));

    return {
        refresh,
        blocked,
        clearBlocked,
        openPanel,
        closePanel,
        openSettings,
        toggleGameView,
        setHud,
        hudOn: () => hudOn(ctx.extensionSettings),
        syncScreens() { syncScreens(); refresh(); mounts.card?.refreshAll?.({ force: true }); },
        screens,
        tabs: tabsControl,
        mounts,
        renderer,
        notes,
        extras,
        savePoints,
        inspector,
        theme,
        cardOffer,
        destroy() {
            offerView?.destroy();
            leanRpg.destroy();
            overlay?.close?.();
            mounts.dialog?.closeAll?.();
            tabHost?.destroy?.();
            tabHost?.bar?.destroy();
            mounts.screen?.destroy?.();
            theme.destroy();
            doc.removeEventListener?.('keydown', onKey);
            offs.splice(0).forEach(off => off?.());
            notes.destroy();
            sendNote.destroy();
            extras.destroy();
        },
    };
}
