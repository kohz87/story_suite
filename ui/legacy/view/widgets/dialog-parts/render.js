// Story Suite v2: drawing the dialog: its panel, open and close, focus handling and the answer it sends.

import { h, iconNode, runCommand, shell } from '../dom.js';
import { resolveProps } from '../props.js';
import { focusNode } from '../../scroll.js';
import { focusablesIn as keyFocusables, stackOf } from '../../modal-stack.js';
import { short } from './shared-text.js';
import { dialogProps } from './props.js';
import { dialogActions, dialogParagraphs } from './content.js';

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]';
let serial = 0;

// Whether a node is in a hidden subtree of `root` (the fake and the real DOM both answer).
function hiddenWithin(node, root) {
    for (let n = node; n && n !== root; n = n.parentNode) if (n.hidden) return true;
    return false;
}
const focusablesIn = root => Array.from(root.querySelectorAll(FOCUSABLE)).filter(node => !node.disabled && !hiddenWithin(node, root) && node.getAttribute?.('tabindex') !== '-1');

export function renderDialog(el, input, api) {
    let p = resolveProps(dialogProps, input);
    return shell(el, 'div', 'dialog', ({ doc, root, listen, cleanup }) => {
        const id = `ss-modal-${(serial += 1)}`;
        root.classList.add('ss-modal');
        const panel = h(doc, 'div', 'ss-modal-panel ss-glass-strong');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('tabindex', '-1');
        const head = h(doc, 'div', 'ss-modal-head');
        const title = h(doc, 'h2', 'ss-modal-title');
        title.setAttribute('id', `${id}-title`);
        const close = h(doc, 'button', 'ss-modal-close');
        close.setAttribute('type', 'button');
        close.setAttribute('aria-label', 'Close');
        const times = h(doc, 'span', '', '×');
        times.setAttribute('aria-hidden', 'true');
        close.appendChild(times);
        head.append(title, close);
        const text = h(doc, 'div', 'ss-modal-text');
        text.setAttribute('id', `${id}-text`);
        const foot = h(doc, 'div', 'ss-modal-foot');
        panel.append(head, text, foot);
        root.appendChild(panel);

        let isOpen = false;
        let lastProp = null;
        let alive = true;
        const win = doc.defaultView;
        const later = fn => (typeof win?.requestAnimationFrame === 'function' ? win.requestAnimationFrame(() => alive && fn()) : fn());

        let layer = null;         // the dialog's entry in the shared stack (modal-stack.js) while it is open
        // Escape closes it (unless it is not closable), Tab stays in the panel and a focus that lands outside is brought back in:
        // the shared stack does that for the topmost layer only.
        function show() {
            if (isOpen) return;
            isOpen = true;
            root.hidden = false;
            layer = stackOf(doc).push({ name: 'dialog', root: panel, onEscape: () => { if (!p.closable) return false; finish('close'); return true; } });
            later(() => {
                if (!isOpen) return;
                const main = foot.querySelector('.ss-modal-primary');
                focusNode(main ?? keyFocusables(panel)[0] ?? panel);
            });
        }
        function hide() {
            if (!isOpen) return;
            isOpen = false;
            root.hidden = true;
            const was = layer;
            layer = null;
            if (was) stackOf(doc).pop(was);
        }
        // An answer: the command, then close.
        function finish(answer) {
            runCommand(api, p.onSelect, { dialog: answer });
            hide();
        }
        listen(close, 'click', () => finish('close'));
        listen(foot, 'click', event => {
            const button = [...foot.querySelectorAll('button')].find(node => node === event.target || node.contains?.(event.target));
            if (button) finish(button.getAttribute('data-id'));
        });
        // A click on the dimmed page behind (not on the panel) closes it.
        listen(root, 'click', event => {
            if (event.target === root && p.closable) finish('close');
        });
        cleanup(() => {
            alive = false;
            hide();
        });

        function update() {
            const label = short(p.title, 100);
            title.textContent = label;
            panel.setAttribute('role', p.alert ? 'alertdialog' : 'dialog');
            if (label) {
                panel.setAttribute('aria-labelledby', title.id);
                panel.removeAttribute('aria-label');
            } else {
                panel.removeAttribute('aria-labelledby');
                panel.setAttribute('aria-label', short(p.label, 60) || 'Dialog');
            }
            title.hidden = !label;
            const paragraphs = dialogParagraphs(p.text);
            text.replaceChildren(...paragraphs.map(part => h(doc, 'p', 'ss-modal-paragraph', part)));
            text.hidden = !paragraphs.length;
            if (paragraphs.length) panel.setAttribute('aria-describedby', text.id);
            else panel.removeAttribute('aria-describedby');
            close.hidden = !p.closable;
            const active = doc.activeElement;
            const keep = active && foot.contains?.(active) ? active.getAttribute?.('data-id') : null;
            foot.replaceChildren();
            const actions = dialogActions(p.actions);
            for (const action of actions) {
                const button = h(doc, 'button', `ss-modal-action ss-modal-${action.kind}`);
                button.setAttribute('type', 'button');
                button.setAttribute('data-id', action.id);
                const glyph = iconNode(doc, action.icon, 'ss-modal-icon');
                if (glyph) button.appendChild(glyph);
                button.appendChild(h(doc, 'span', '', action.label));
                foot.appendChild(button);
            }
            foot.hidden = !actions.length;
            if (keep) focusNode([...foot.querySelectorAll('button')].find(button => button.getAttribute('data-id') === keep));
        }
        update();
        lastProp = p.open;
        if (p.open) show();
        else root.hidden = true;
        return {
            update(next) {
                p = resolveProps(dialogProps, next);
                update();
                // Closed by the reader stays closed until the screen asks for it open again.
                if (p.open !== lastProp) {
                    lastProp = p.open;
                    if (p.open) show();
                    else hide();
                }
            },
        };
    });
}
