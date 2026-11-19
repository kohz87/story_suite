// The Cast views and the Dossiers pane as `people` sections of Story Block's sdk.panels (flag `suite.redrawScheduler`).
// While the flag is on, a change of the cast is `touch()` (→ `panels.changed(['people'])`) and the scheduler draws each section once in
// the next frame; while it is off (or the host has no sdk.panels) `panels()` is null, nothing here registers and the old direct redraws run.
// A view or pane drawn while the flag was off is not registered, so `viewCovered` / `paneCovered` tell the old path to keep drawing it.

const PEOPLE = Object.freeze(['people']);

export function createCastPanels(session, deps) {
    const { warn } = deps;
    const covered = new WeakSet();   // the Cast views (boxes) a section draws
    let paneEl = null;               // the Dossiers pane a section draws (session.castEl)
    let offPane = null;
    let views = 0;                   // one section id per Cast view (a second view must not take the first one's section)

    /** The sdk's panels while they are on, else null (the old paths run). */
    const panels = () => {
        try {
            const found = session.hosted ? session.sdkRef?.panels : null;
            return found?.on === true ? found : null;
        } catch { return null; }
    };
    return {
        /** The cast changed (the page API's change notice): mark the people sections. */
        touch() {
            const found = panels();
            if (!found) return;
            found.changed(PEOPLE);
        },
        /** A Cast view (`box`) was drawn: its section draws it again when the people change. → the release, or null when the old path keeps it. */
        view(box, draw) {
            const found = panels();
            if (!found) return null;
            const off = found.register(`people.cast-view.${views += 1}`, { keys: PEOPLE, drawn: true, root: () => box, isVisible: () => box.isConnected !== false, draw });
            covered.add(box);
            return () => { covered.delete(box); off(); };
        },
        // (the flag turned off while a view is on screen: the old loops draw it again)
        viewCovered: box => panels() !== null && covered.has(box),
        /** The Dossiers tab pane (`el`) was drawn: `draw(el)` draws it again while `shown(el)` says the pane still holds the Cast tab. */
        pane(el, draw, shown) {
            const found = panels();
            if (!found || !el) return;
            offPane?.();
            paneEl = el;
            offPane = found.register('people.dossiers-pane', {
                keys: PEOPLE, drawn: true, root: () => el, isVisible: () => el.isConnected !== false && shown(el), draw: () => { try { draw(el); } catch (error) { warn('Story Suite v2 Dossiers tab failed', error); } },
            });
        },
        paneCovered: el => panels() !== null && paneEl !== null && paneEl === el,
    };
}
