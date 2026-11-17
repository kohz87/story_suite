// The common widget shell (root, tracked listeners, safe update/destroy), its stylesheet and the command runner.

import { widgetCss } from '../styles.js';
import { docOf, h } from './elements.js';

/**
 * Runs a command through the widget api, if both are given. Results are the host's to report (it shows
 * failures in plain words); a widget never throws at the reader.
 */
export function runCommand(api, type, payload) {
    if (typeof type !== 'string' || !type || typeof api?.command !== 'function') return false;
    try {
        const result = api.command(type, payload);
        if (result && typeof result.then === 'function') result.then(undefined, () => {});
    } catch {
        // The host already reported it.
    }
    return true;
}

/** Adds the widgets' base stylesheet to a document once (low specificity: any screen CSS overrides it). */
export function ensureStyles(doc) {
    const head = doc?.head;
    if (!head || head.querySelector('style[data-ss-widgets]')) return;
    const style = doc.createElement('style');
    style.setAttribute('data-ss-widgets', '');
    style.textContent = widgetCss;
    head.appendChild(style);
}

/**
 * The common widget shell: a root element appended to `el`, listeners tracked so destroy() removes them,
 * and update()/destroy() that are safe to call after destroy.
 */
export function shell(el, tag, name, draw) {
    const doc = docOf(el);
    ensureStyles(doc);
    const root = h(doc, tag, `ss-w ss-w-${name}`);
    const listeners = [];
    const cleanups = [];
    let alive = true;
    const ctx = {
        doc,
        root,
        listen(node, type, fn, options) {
            node.addEventListener(type, fn, options);
            listeners.push([node, type, fn, options]);
        },
        cleanup(fn) { cleanups.push(fn); },
    };
    el.appendChild(root);
    const view = draw(ctx);
    return {
        update(props) {
            if (alive) view.update(props);
        },
        destroy() {
            if (!alive) return;
            alive = false;
            for (const [node, type, fn, options] of listeners) node.removeEventListener(type, fn, options);
            listeners.length = 0;
            for (const fn of cleanups) {
                try { fn(); } catch { /* best effort */ }
            }
            view.destroy?.();
            root.remove();
        },
    };
}
