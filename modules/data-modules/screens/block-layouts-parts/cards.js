// Draws a list of records as compact cards (open ones first, finished ones folded) and gives a status value its tone.
import { h, iconNode } from '../../../../ui/legacy/view/widgets/dom.js';
import { defaultTone } from '../../block-builder.js';
import { ensureLayoutStyles } from '../../../../ui/legacy/layout/styles.js';
import { fill } from '../../../../core/strings.js';
import { V, chip, pencilFor } from './shared-chrome.js';

/** The tone of a status value: the block's `tones` entry, else the editor's default (active, done and failed by their name, any other value neutral and open). */
export function statusTone(definition, values, value) {
    const given = definition?.tones?.[value];
    return ['active', 'done', 'failed', 'neutral'].includes(given) ? given : defaultTone(value);
}
const isOpen = tone => tone === 'active' || tone === 'neutral';

// ---- a list of records -----------------------------------------------------------------------------------------------------------------

/**
 * Cards for records. `items`: [{ id, title, text, step, tone, statusLabel, name, edit }] where `edit` (or null) is the editable's props for the card's pencil.
 * env.memory remembers which descriptions and "Finished" are open across redraws.
 */
export function drawCards(env, parent, items, { key = 'cards' } = {}) {
    const { doc } = env;
    ensureLayoutStyles(doc);
    const open = items.filter(item => isOpen(item.tone)), done = items.filter(item => !isOpen(item.tone));
    const card = item => {
        const li = h(doc, 'li', 'ss-b-quest');
        li.setAttribute('data-quest', item.id);
        li.setAttribute('data-tone', item.tone);
        const head = h(doc, 'div', 'ss-b-q1'); li.appendChild(head);
        head.appendChild(h(doc, 'b', 'ss-b-qt', item.title));
        if (item.statusLabel) head.appendChild(chip(doc, item.statusLabel, item.tone));
        if (item.edit) pencilFor(env, head, item.edit, { quest: item.id });
        const memory = `${key}:${item.id}`;
        let text = null, more = null;
        if (item.text) {
            text = h(doc, 'p', 'ss-b-q2', item.text);
            text.setAttribute('data-open', String(env.memory.get(memory) === true));
            li.appendChild(text);
        }
        const foot = h(doc, 'div', 'ss-b-q3'); li.appendChild(foot);
        if (item.step) {
            const glyph = iconNode(doc, isOpen(item.tone) ? 'ph-map-pin' : 'ph-check-circle', 'ss-w-icon ss-b-stepicon');
            if (glyph) foot.appendChild(glyph);
            foot.appendChild(h(doc, 'span', 'ss-b-step', item.step));
        }
        if (text) {
            more = h(doc, 'button', 'ss-pill ss-pill-outline ss-tap-pill ss-b-more', V.more);
            more.setAttribute('type', 'button');
            const sync = () => {
                const expanded = text.getAttribute('data-open') === 'true';
                more.textContent = expanded ? V.less : V.more;
                more.setAttribute('aria-expanded', String(expanded));
            };
            sync();
            more.addEventListener('click', () => {
                env.memory.set(memory, text.getAttribute('data-open') !== 'true');
                text.setAttribute('data-open', String(env.memory.get(memory)));
                sync();
            });
            // Shown only where the text is cut (measured once drawn); a long text is assumed cut where nothing can be measured.
            const cut = () => {
                if (text.getAttribute('data-open') === 'true') return true;
                return text.clientHeight > 0 ? text.scrollHeight > text.clientHeight + 1 : [...item.text].length > 90;
            };
            more.hidden = !cut();
            foot.appendChild(more);
            const recheck = () => { more.hidden = !cut(); };
            const view = doc.defaultView;
            if (typeof view?.requestAnimationFrame === 'function') view.requestAnimationFrame(recheck);
            if (typeof view?.ResizeObserver === 'function') {
                const observer = new view.ResizeObserver(recheck);
                observer.observe(li);
                env.handles.push({ destroy() { observer.disconnect(); } });
            }
        }
        foot.hidden = !item.step && !text;
        return li;
    };
    const root = h(doc, 'div', 'ss-b-quests-root ss-l-root'); parent.appendChild(root);
    if (open.length) {
        const section = h(doc, 'section', 'ss-b-sec'); root.appendChild(section);
        section.appendChild(h(doc, 'h4', 'ss-section-label', fill(V.active, { n: open.length })));
        const list = h(doc, 'ul', 'ss-b-qs'); section.appendChild(list);
        for (const item of open) list.appendChild(card(item));
    }
    if (done.length) {
        const fold = h(doc, 'details', 'ss-b-fold');
        const label = `${key}:finished`;
        if (env.memory.get(label) === true) fold.setAttribute('open', '');
        fold.addEventListener('toggle', () => env.memory.set(label, fold.open === true));
        fold.appendChild(h(doc, 'summary', '', fill(V.finished, { n: done.length })));
        const list = h(doc, 'ul', 'ss-b-qs'); fold.appendChild(list);
        for (const item of done) list.appendChild(card(item));
        root.appendChild(fold);
    }
    if (!open.length && !done.length) root.appendChild(h(doc, 'p', 'ss-b-none', V.nothing));
    return root;
}
