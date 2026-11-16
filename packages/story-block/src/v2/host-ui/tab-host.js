// Story Suite v2: the tab host (moved out of host-ui.js unchanged; host-ui.js re-exports createTabHost): the story panel's tab bar
// with every module tab, each rendered from the head state's view.

import { createScreenBar } from '../view/screen-bar.js';
import { iconFor } from '../view/icons/index.js';
import { dispose } from '../view/mounts/common.js';
import { el } from './controls.js';
import { S } from './text.js';
import { captureField, restoreField } from './field-carry.js';

/**
 * The story panel's tab host, drawn into `root`: one pane, the chosen tab's, rendered with `tab.render(pane, view(), api)`,
 * and the screen bar (view/screen-bar.js) at the foot of the panel, in `barHost` (the panel itself; `root` if none): every tab in one
 * row that scrolls sideways, no More. The tabs are `registry.tabs()`, in its order (Story Block's
 * panel gives the module tabs and the tab screens in the reader's order, without the hidden ones). A tab that is gone falls
 * back to the first. The pane scrolls inside `root`; the bar stays where it is.
 * `options`: { registry, view: () => view, api (the sdk), doc?, active?, barHost?, swap? (() => true while the redraw scheduler's flag is on: the pane is drawn apart and swapped in), inBar? (tab → in the bar; the others follow
 * the ones that are, in the same strip) }. Tabs read the head state's view only,
 * never message text. Returns { refresh({ guard?, carry? }), select(id), active(), bar }: refresh() is guarded by default.
 */
export function createTabHost(root, { registry, view, api = null, doc = globalThis.document, active = null, barHost = null, inBar = null, swap = null }) {
    let current = active;
    let watch = null;         // swap draw: { pane, done, timer } while a deferred host redraw waits on a field in the pane
    let dead = false;         // destroy() ran: nothing is drawn any more
    let release = null;       // what the last drawing of the pane left behind (a dispose function or { destroy }), taken down on the next draw
    let pane = el(doc, 'div', 'story-suite-pane');
    root.replaceChildren(pane);
    // The panel's own names on each tab's button: `story-suite-tab` and `data-tab-id` (the tests and the
    // modules use them), and the full label as the title (the bar cuts a long one).
    const bar = createScreenBar(doc, barHost ?? root, {
        label: S.panel.tabs,
        className: 'story-suite-sheet-bar',
        onSelect: id => select(id),
        decorate(node, item) {
            node.classList.add('story-suite-tab');
            node.setAttribute('data-tab-id', item.id);
        },
    });

    // The strip: every tab in one row that scrolls sideways, the ones in the bar first (the reader's order), the rest after them.
    function drawBar(tabs) {
        bar.update({ items: tabs.map(tab => ({ id: tab.id, label: tab.title, icon: iconFor(tab.id, tab.icon), alert: tab.alert === true,
            alertText: tab.alertText ?? '', moreOnly: typeof inBar === 'function' && !inBar(tab) })), current: current ?? '' });
    }

    // Flag suite.redrawScheduler (`swap()` true): the pane is drawn apart and swapped in, so the old one stays shown until the new one is
    // ready (no empty moment) and the panel's scroll is kept. Flag off: drawPlain, as it always was.
    function drawSwap(carry = true) {
        const carried = carry && pane.dataset.tabId === current ? captureField(doc, pane) : null;   // (a draw that replaces the same tab's pane under a focused field)
        const top = root.scrollTop;   // (read before the old pane's widgets are taken down: their removal can clamp the scroll)
        cancelWatch();
        const tabs = registry.tabs();
        if (!tabs.some(tab => tab.id === current)) current = tabs[0]?.id ?? null;
        drawBar(tabs);
        dispose(pane);
        if (typeof release === 'function') { try { release(); } catch { /* a tab's cleanup failing must not block the redraw */ } }
        release = null;
        const next = el(doc, 'div', 'story-suite-pane');
        const tab = tabs.find(item => item.id === current);
        next.dataset.tabId = tab?.id ?? '';
        if (!tab) next.appendChild(el(doc, 'p', 'story-suite-muted', 'No module has a tab yet.'));
        else {
            try {
                const out = tab.render(next, view(), api);
                if (typeof out === 'function') release = out;
                else if (out && typeof out.destroy === 'function') release = () => out.destroy();
            } catch (error) {
                next.replaceChildren(el(doc, 'p', 'story-suite-muted', `${tab.title} could not be shown: ${error?.message ?? error}`));
            }
        }
        // (the swap is one step; the bar may share `root`, so only the old pane is replaced)
        if (pane.parentNode) { pane.parentNode.insertBefore(next, pane); pane.remove(); } else root.prepend(next);
        pane = next;
        if (carried) restoreField(next, carried);
        if (top) root.scrollTop = top;
    }
    // A host redraw never takes a field the reader is typing in out from under them: it waits for the field to lose focus, then runs once.
    function typingIn() {
        const at = doc?.activeElement;
        return Boolean(at && pane.contains?.(at) && (['INPUT', 'TEXTAREA', 'SELECT'].includes(String(at.tagName ?? '').toUpperCase()) || at.isContentEditable === true));
    }
    function cancelWatch() {
        if (!watch) return;
        watch.pane.removeEventListener?.('focusout', watch.done);
        if (watch.timer !== null) (doc?.defaultView?.clearTimeout ?? clearTimeout)(watch.timer);
        watch = null;
    }
    // (a focus move inside the pane, a field to a field or a button, is not a blur; when the timer runs the guard looks again: a phone's app switch keeps the field focused)
    function waitForBlur() {
        if (watch?.pane === pane) return;
        cancelWatch();
        const mine = { pane, timer: null, done: null };
        mine.done = event => {
            if (event?.relatedTarget && mine.pane.contains?.(event.relatedTarget)) return;
            mine.pane.removeEventListener?.('focusout', mine.done);
            mine.timer = (doc?.defaultView?.setTimeout ?? setTimeout)(() => {
                if (watch === mine) watch = null;
                // (a pane already replaced, a closed panel or the flag turned off needs nothing; opening the panel draws it)
                if (dead || pane !== mine.pane || (barHost ?? root).hidden === true || swap?.() !== true) return;
                draw({ guard: true });
            }, 0);
        };
        watch = mine;
        mine.pane.addEventListener?.('focusout', mine.done);
    }

    function draw({ guard = false, carry = true } = {}) {
        if (dead) return;
        if (swap?.() === true) {
            if (guard && typingIn()) return waitForBlur();
            return drawSwap(carry);
        }
        drawPlain();
    }
    function drawPlain() {
        const tabs = registry.tabs();
        if (!tabs.some(tab => tab.id === current)) current = tabs[0]?.id ?? null;
        drawBar(tabs);
        // The pane's widgets go before the pane is drawn again (a redraw of the same tab too): their listeners and observers.
        dispose(pane);
        if (typeof release === 'function') { try { release(); } catch { /* a tab's cleanup failing must not block the redraw */ } }
        release = null;
        pane.replaceChildren();
        const tab = tabs.find(item => item.id === current);
        pane.dataset.tabId = tab?.id ?? '';
        if (!tab) {
            pane.appendChild(el(doc, 'p', 'story-suite-muted', 'No module has a tab yet.'));
            return;
        }
        try {
            const out = tab.render(pane, view(), api);
            if (typeof out === 'function') release = out;
            else if (out && typeof out.destroy === 'function') release = () => out.destroy();
        } catch (error) {
            pane.replaceChildren(el(doc, 'p', 'story-suite-muted', `${tab.title} could not be shown: ${error?.message ?? error}`));
        }
    }
    function select(id) {
        current = id;
        draw();
    }
    draw();
    return {
        // (a refresh is a background one: guarded unless the caller says `guard: false`; select() and the first draw are the reader's own)
        refresh: opts => draw({ guard: true, ...(opts ?? {}) }),
        select,
        active: () => current,
        bar,
        /** Takes the open tab's widgets down (its pane disposed, and what its render returned). */
        destroy() {
            dead = true;
            cancelWatch();
            dispose(pane);
            if (typeof release === 'function') { try { release(); } catch { /* a tab's cleanup failing must not block teardown */ } }
            release = null;
        },
    };
}
