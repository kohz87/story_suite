// Finding the host and registering with it (src/storysuite-v2.js): look for a Story Block v2 on the page a bounded number of times,
// register Delta's module, watch that the host is still the one registered with, and give everything back when it goes.
//
// A part of the adapter closure: createConnectPart(session, deps) gets the adapter's shared state (session) and the adapter's options,
// constants and the parts built before it (deps), and returns what the other parts and the adapter use. No SillyTavern import.

/** True when `host` looks like Story Block v2's global: a `ready` promise or an `sdk` object. */
export function isV2Host(host) {
    if (!host || (typeof host !== 'object' && typeof host !== 'function')) return false;
    return typeof host.ready?.then === 'function' || typeof host.sdk?.registerModule === 'function';
}

// The id Delta's listeners are guarded under (the host's `sdk.on(name, fn, { module })`); the same as its module id.
const MODULE = 'npc-state-delta';

export function createConnectPart(session, deps) {
    const {
        aliveMs, announceHosted, attempts, cardSettings, chatKeyOf, definition, dossiersReady, host, listen, loadDossierList,
        doc, loadEmptyCast, onTurn: runTurn, peopleSync, portraitFill: fillPortraits, registerCardSettings, registerPublicPaths, retryMs, startTimeline, stopTimeline,
        syncDrawer, timers, unmountSection, warn,
    } = deps;

    // A host capture or Re-read that settles after Delta's last render: an open dossier panel asks to draw again (it draws only
    // when its view token moved).
    function refreshPanel() {
        try { doc?.getElementById?.('npc_state_delta_dossier_root')?.__npcStateDeltaStage1Ui?.scheduleRefresh?.(); } catch { /* no panel open */ }
    }
    // The host's 'turn' and 'head' events run Delta's own steps, then the panel's refresh.
    // The cache stands on the head's reply (a swipe, a delete, a rewind or a new reply moved the head): the look is queued before any commit of Delta's own, so a
    // commit never goes out for a reply the cache does not stand on. Delta's own step is not held for it.
    const onTurn = turn => { void peopleSync.sync().catch(() => {}); try { return runTurn(turn); } finally { refreshPanel(); } };
    const portraitFill = (...args) => { void peopleSync.sync().catch(() => {}); try { return fillPortraits(...args); } finally { refreshPanel(); } };

    let aliveTimer = null;
    let hostRef = null;          // the Story Block global we connected to
    let offTurn = null;          // unsubscribes from the host's 'turn' event
    let offHead = null;          // unsubscribes from the host's 'head' event
    let offCardSettings = null;  // unregisters Delta's card settings
    let giveUpTimer = null;      // the bound on the host's `ready` (a host that never becomes ready counts as refused)
    const stopGiveUp = () => { if (giveUpTimer !== null) timers.clearTimeout?.(giveUpTimer); giveUpTimer = null; };

    async function register(sdk, from, attempt) {
        if (hostRef !== from) return false;
        if (host() !== from) {
            // Replaced while it was getting ready: look again (still within the bound).
            hostRef = null;
            if (session.started) schedulePoll(attempt + 1);
            return false;
        }
        if (typeof sdk?.registerModule !== 'function' || session.sdkRef === sdk) return false;
        session.sdkRef = sdk;
        // The host's registerModule is async: Delta is hosted (drawer copy, launcher and in-chat cast
        // step aside) only once the host has accepted the module, never on a refusal.
        try {
            await sdk.registerModule(definition);
        } catch (error) {
            if (session.sdkRef === sdk) session.sdkRef = null;
            session.refused = true;
            warn('Story Suite v2 registration failed; Delta keeps working on its own', error);
            return false;
        }
        if (!session.started || hostRef !== from || session.sdkRef !== sdk) return false;
        session.hosted = true;
        session.refused = false;
        try {
            const off = typeof sdk.on === 'function' ? sdk.on('turn', onTurn, { module: MODULE }) : null;
            offTurn = typeof off === 'function' ? off : null;
        } catch (error) { warn('Story Suite v2 turn events are not available', error); }
        try {
            const off = typeof sdk.on === 'function' ? sdk.on('head', portraitFill, { module: MODULE }) : null;
            offHead = typeof off === 'function' ? off : null;
        } catch (error) { warn('Story Suite v2 head events are not available', error); }
        offCardSettings = registerCardSettings(sdk, cardSettings);
        session.offPublicPaths = registerPublicPaths(sdk);
        session.baselineKey = dossiersReady() ? chatKeyOf() : null;
        listen();
        syncDrawer();
        announceHosted(true);
        portraitFill();
        startTimeline();
        aliveTimer = timers.setInterval?.(check, aliveMs) ?? null;
        aliveTimer?.unref?.();
        return true;
    }

    function connect(sb, attempt) {
        hostRef = sb;
        const ready = typeof sb.ready?.then === 'function' ? sb.ready : Promise.resolve(sb.sdk);
        const cast = Promise.resolve().then(() => loadEmptyCast()).then(fn => {
            if (typeof fn === 'function') session.emptyCast = fn;
        }, () => { /* keep the fallback line */ });
        // The dossier list's markup; until it loads (or if it cannot), plain rows of names.
        Promise.resolve().then(() => loadDossierList?.()).then(parts => {
            if (parts && typeof parts.rowNodes === 'function') session.listParts = parts;
        }, () => { /* plain rows */ });
        // The host's `ready` may never settle (its boot stopped): after the same bound as the look for a host, it counts as refused, so the sidecar is given back.
        stopGiveUp();
        giveUpTimer = timers.setTimeout?.(() => {
            giveUpTimer = null;
            if (session.started && hostRef === sb && !session.hosted) { session.refused = true; warn('Story Block v2 did not become ready in time; Delta keeps working on its own'); }
        }, attempts * retryMs) ?? null;
        giveUpTimer?.unref?.();
        return Promise.all([ready, cast])
            .then(([sdk]) => { stopGiveUp(); return register(sdk, sb, attempt); })
            .catch(error => {
                stopGiveUp();
                session.refused = true;
                warn('Story Block v2 did not become ready; Delta keeps working on its own', error);
                return false;
            });
    }

    function poll(attempt) {
        session.pollTimer = null;
        if (!session.started || hostRef) return;
        const sb = host();
        if (isV2Host(sb)) {
            session.pending = connect(sb, attempt);
            return;
        }
        schedulePoll(attempt + 1);
    }

    function schedulePoll(attempt) {
        if (attempt > attempts || session.pollTimer !== null) return;
        session.pollTimer = timers.setTimeout?.(() => poll(attempt), retryMs) ?? null;
        session.pollTimer?.unref?.();
    }

    // The host went away (or was replaced): everything goes back as it was before hosting.
    function unhost() {
        stopGiveUp();
        if (aliveTimer !== null) timers.clearInterval?.(aliveTimer);
        aliveTimer = null;
        const was = session.hosted;
        session.hosted = false;
        stopTimeline();
        peopleSync.forget();
        try { offTurn?.(); } catch { /* the host is gone */ }
        offTurn = null;
        try { offHead?.(); } catch { /* the host is gone */ }
        offHead = null;
        try { offCardSettings?.(); } catch { /* the host is gone */ }
        offCardSettings = null;
        try { session.offPublicPaths?.(); } catch { /* the host is gone */ }
        session.offPublicPaths = null;
        session.baselineKey = null;
        session.refused = false;
        hostRef = null;
        session.sdkRef = null;
        session.pendingSection = null;
        session.castEl = null;
        unmountSection();
        syncDrawer();
        if (was) announceHosted(false);
    }

    /** Checks that the host is still there; restores the drawer and looks again when it is not. */
    function check() {
        if (!hostRef || host() === hostRef) return session.hosted;
        unhost();
        if (session.started) poll(0);
        return false;
    }

    /**
     * Who holds the chat's state: 'hosted' (the host accepted the module: the store holds the people), 'pending' (a v2 host is on the page and has not
     * accepted yet: nothing is written to a sidecar meanwhile, so the window before the connection leaves no file behind), or false (no host, or it refused).
     */
    function storeOwns() {
        if (session.hosted) return 'hosted';
        return session.started && !session.refused && isV2Host(host()) ? 'pending' : false;
    }

    return {
        poll, unhost, check, storeOwns,
    };
}
