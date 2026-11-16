// Opens the sample over the page as a full-screen layer with a Close button.

import { createScreenRenderer } from '../../view/render-screen.js';
import { UI_SAMPLE_ID, UI_SAMPLE_TEXT } from './text.js';
import { mountDemoForm } from './form.js';
import { UI_SAMPLE_DATA } from './data.js';
import { uiSampleScreen } from './template.js';

/**
 * Opens the sample over the page: a full-screen layer (SillyTavern's background shows through it) with a
 * Close button; Escape closes it too. `widgets()` → the registered widgets; `sanitize` SillyTavern's
 * DOMPurify. → { root, close() }. A second call closes the first.
 */
export function openUiSample({ doc = globalThis.document, widgets = () => ({}), sanitize = null } = {}) {
    doc.querySelector?.('#story_suite_ui_sample')?.remove();
    const before = doc.activeElement ?? null;
    const T = UI_SAMPLE_TEXT;
    const layer = doc.createElement('div');
    layer.id = 'story_suite_ui_sample';
    layer.className = 'ss-sample';
    layer.setAttribute('data-ss-screen', UI_SAMPLE_ID);
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-labelledby', 'story_suite_ui_sample_title');
    const head = doc.createElement('div');
    head.className = 'ss-sample-head ss-glass-strong';
    const title = doc.createElement('b');
    title.id = 'story_suite_ui_sample_title';
    title.textContent = T.title;
    const note = doc.createElement('small');
    note.textContent = T.note;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'menu_button ss-sample-close';
    close.textContent = T.close;
    close.title = T.closeTitle;
    head.append(title, note, close);
    const body = doc.createElement('div');
    body.className = 'ss-sample-body';
    layer.append(head, body);
    doc.body.appendChild(layer);
    const renderer = createScreenRenderer({ queryAt: () => null, widgets, sanitize });
    let cleanup = null;
    try {
        cleanup = renderer.render(body, uiSampleScreen, { mount: 'dialog', q: UI_SAMPLE_DATA, state: null, api: {} });
    } catch (error) {
        body.textContent = `The UI sample could not be drawn: ${error?.message ?? error}`;
    }
    // The demo form of the form engine, into each pane's slot (its own store each: nothing of the reader's is touched).
    const demos = [];
    for (const slot of layer.querySelectorAll?.('.ss-sample-form') ?? []) {
        try { demos.push(mountDemoForm(doc, slot)); } catch (error) { slot.textContent = `The demo form could not be drawn: ${error?.message ?? error}`; }
    }
    let open = true;
    const api = {
        root: layer,
        close() {
            if (!open) return;
            open = false;
            for (const demo of demos) { try { demo.destroy(); } catch { /* the layer goes either way */ } }
            try { cleanup?.(); } catch { /* the layer goes either way */ }
            layer.remove();
            if (before && before !== doc.body && before.isConnected !== false) before.focus?.();
        },
    };
    layer.addEventListener('keydown', event => {
        if (event?.key !== 'Escape') return;
        event.preventDefault?.();
        event.stopPropagation?.();
        api.close();
    });
    close.addEventListener('click', () => api.close());
    // "Open a dialog": the widget ss.dialog over the page (in a wrapper of its own: a fixed panel inside a glass
    // card with a backdrop filter would sit in that card), in the scheme of the pane its button is in.
    const dialogWidget = (typeof widgets === 'function' ? widgets() : {})?.['ss.dialog'];
    if (dialogWidget && typeof layer.querySelectorAll === 'function') {
        for (const opener of layer.querySelectorAll('.ss-sample-open-dialog')) {
            opener.addEventListener('click', () => {
                const scheme = opener.closest?.('.ss-scheme-dark') ? 'dark' : 'light';
                const wrap = doc.createElement('div');
                // ss-sample-dialog: inside the zoom and the phone's 44px rule like the sample itself (view/size.css)
                wrap.className = `ss-sample-dialog ss-scheme-${scheme}`;
                wrap.setAttribute('data-ss-screen', UI_SAMPLE_ID);
                doc.body.appendChild(wrap);
                let handle = null;
                const done = () => { handle?.destroy(); wrap.remove(); };
                handle = dialogWidget.render(wrap, { ...UI_SAMPLE_DATA.dialog, onSelect: 'sample.dialog' }, { command: () => { done(); } });
            });
        }
    }
    close.focus?.();
    return api;
}
