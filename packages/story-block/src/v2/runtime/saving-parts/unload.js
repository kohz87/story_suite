// The page-unload save: the unsaved story goes out as early as the page lets it (saveOnUnload).

/**
 * On a page: the unsaved story goes out as early as the page lets it (see storeSaving).
 * * Hidden (`visibilitychange` to hidden: a tab switch, a phone putting the browser away) or `pagehide`:
 *   the newest state is saved at once, with keepalive, past a save still on its way. A page often goes
 *   from hidden to gone without another event, on a phone always.
 * * `beforeunload`: the same, and the browser asks first while saves fail, while one is still on its way,
 *   or when the body is too big to go out with keepalive (`fits()` false: more than 64 KiB, most real
 *   chats), since then the save is cut off with the page. SillyTavern 1.19 has no way to write part of a
 *   chat file, so a smaller keepalive request is not possible.
 */
export function saveOnUnload(store, page, { fits = () => true } = {}) {
    if (typeof page?.addEventListener !== 'function') return () => {};
    const doc = page.document ?? null;
    const urgent = (options = {}) => (store.saveUrgent ?? store.saveSoon)?.call(store, { keepalive: true, ...options });
    const onUnload = event => {
        // A1-4: a save still on its way (the server has not answered) would hold a queued one until the
        // page is gone: the newest state goes out at once past it.
        const inFlight = store.inFlight?.() === true;
        const dirty = store.dirty?.() === true;
        if (!dirty && !inFlight) return;
        if (dirty) urgent();
        let big = false;
        if (dirty) {
            try { big = fits() === false; } catch { big = true; }
        }
        if (store.failing?.() || inFlight || big) {
            event.preventDefault?.();
            event.returnValue = true;
        }
    };
    // The page may be going away (pagehide), so a save on its way is sent again with keepalive.
    const onHide = () => {
        if (store.dirty?.() === true) urgent({ force: true });
    };
    const onVisibility = () => {
        if (doc?.visibilityState === 'hidden' && store.dirty?.() === true) urgent();
    };
    page.addEventListener('beforeunload', onUnload);
    page.addEventListener('pagehide', onHide);
    doc?.addEventListener?.('visibilitychange', onVisibility);
    return () => {
        page.removeEventListener?.('beforeunload', onUnload);
        page.removeEventListener?.('pagehide', onHide);
        doc?.removeEventListener?.('visibilitychange', onVisibility);
    };
}
