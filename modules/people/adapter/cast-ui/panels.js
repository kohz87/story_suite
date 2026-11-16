// The Cast views, the Dossiers pane and the open dossier panel as `people` sections of Story Block's sdk.panels (flag `suite.redrawScheduler`).
// While the flag is on, a change of the cast is `touch()` (→ `panels.changed(['people'])`) and the scheduler draws each section once in
// the next frame; while it is off (or the host has no sdk.panels) `panels()` is null, nothing here registers and the old direct redraws run.
// A view or pane drawn while the flag was off is not registered, so `viewCovered` / `paneCovered` tell the old path to keep drawing it.

const PEOPLE = Object.freeze(['people']);
const PANEL_ROOT_ID = 'npc_state_delta_dossier_root';

export function createCastPanels(session, deps) {
    const { doc, warn } = deps;
    const covered = new WeakSet();   // the Cast views (boxes) a section draws
    let paneEl = null;               // the Dossiers pane a section draws (session.castEl)
    let offPane = null;
    let offPanel = null;
    let views = 0;                   // one section id per Cast view (a second view must not take the first one's section)

    /** The sdk's panels while they are on, else null (the old paths run). */
    const panels = () => {
        try {
            const found = session.hosted ? session.sdkRef?.panels : null;
            return found?.on === true ? found : null;
        } catch { return null; }
    };
    const dossierPanel = () => { try { return doc?.getElementById?.(PANEL_ROOT_ID) ?? null; } catch { return null; } };
    // The open dossier panel (v1's) draws again when the people change; it draws only when its own view token moved.
    function ensurePanel(found) {
        if (offPanel) return;
        offPanel = found.register('npc-state-delta.dossier-panel', {
            keys: PEOPLE, drawn: true, root: dossierPanel, isVisible: () => dossierPanel() !== null,
            draw: () => { try { dossierPanel()?.__npcStateDeltaStage1Ui?.scheduleRefresh?.(); } catch (error) { warn('Story Suite v2 dossier panel failed', error); } },
        });
    }
    return {
        /** The cast changed (the page API's change notice): mark the people sections. */
        touch() {
            const found = panels();
            if (!found) return;
            ensurePanel(found);
            found.changed(PEOPLE);
        },
        /** A Cast view (`box`) was drawn: its section draws it again when the people change. → the release, or null when the old path keeps it. */
        view(box, draw) {
            const found = panels();
            if (!found) return null;
            ensurePanel(found);
            const off = found.register(`npc-state-delta.cast-view.${views += 1}`, { keys: PEOPLE, drawn: true, root: () => box, isVisible: () => box.isConnected !== false, draw });
            covered.add(box);
            return () => { covered.delete(box); off(); };
        },
        // (the flag turned off while a view is on screen: the old loops draw it again)
        viewCovered: box => panels() !== null && covered.has(box),
        /** The Dossiers tab pane (`el`) was drawn: `draw(el)` draws it again while `shown(el)` says the pane still holds the Cast tab. */
        pane(el, draw, shown) {
            const found = panels();
            if (!found || !el) return;
            ensurePanel(found);
            offPane?.();
            paneEl = el;
            offPane = found.register('npc-state-delta.dossiers-pane', {
                keys: PEOPLE, drawn: true, root: () => el, isVisible: () => el.isConnected !== false && shown(el), draw: () => { try { draw(el); } catch (error) { warn('Story Suite v2 Dossiers tab failed', error); } },
            });
        },
        paneCovered: el => panels() !== null && paneEl !== null && paneEl === el,
    };
}
