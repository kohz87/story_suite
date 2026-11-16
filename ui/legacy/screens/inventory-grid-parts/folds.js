// The Grid view's fold state (kept per chat on this device) and its foldable section.

import { h, s as svg } from '../../view/widgets/dom.js';

/** Open or closed, remembered per key. `prefix` names the chat (the caller adds it), so each chat keeps its own folds on this device. A storage that
 *  throws or is missing gives the fallback, and the choice then lasts only this page. */
export function foldStore({ prefix, storage = undefined }) {
    const area = () => { try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; } };
    const kept = new Map();
    const key = id => `${prefix}${id}`;
    return Object.freeze({
        get(id, fallback) {
            if (kept.has(id)) return kept.get(id);
            try {
                const value = area()?.getItem?.(key(id));
                return value == null ? fallback : value === '1';
            } catch { return fallback; }
        },
        set(id, open) {
            kept.set(id, open);
            try { area()?.setItem?.(key(id), open ? '1' : '0'); } catch { /* the choice lasts this page only */ }
        },
    });
}

const slug = id => String(id).replace(/[^\w-]/g, '-');

function chevron(doc) {
    const box = h(doc, 'span', 'fold-chev');
    const drawn = svg(doc, 'svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    drawn.appendChild(svg(doc, 'path', { d: 'M4.5 2.5 8 6l-3.5 3.5' }));
    box.appendChild(drawn);
    return box;
}

/** A foldable section: a button with a chevron, the label (and an icon, a count when given) and the body under it. `onToggle(open)` gets the new state. */
export function foldSection(doc, { id, label, icon = '', count = null, open, onToggle, body, className = '', rule = false }) {
    const section = h(doc, 'section', `fold-sec ${className}`.trim());
    const bodyId = `fold-body-${slug(id)}`;
    const head = h(doc, 'button', `fold-head${open ? ' is-open' : ''}`);
    head.setAttribute('type', 'button');
    head.setAttribute('aria-expanded', String(open));
    head.setAttribute('aria-controls', bodyId);
    head.setAttribute('data-fold', String(id));
    if (rule) head.append(chevron(doc));   // the rule-style head: chevron, label, a hairline (CSS) and the count at the right
    if (icon) {
        const mark = h(doc, 'i', `fa-solid ${icon}`);
        mark.setAttribute('aria-hidden', 'true');
        head.append(mark);
    }
    head.append(h(doc, 'span', 'fold-label', label));
    if (count !== null) head.append(h(doc, 'span', 'fold-count', String(count)));
    if (!rule) head.append(chevron(doc));
    head.addEventListener('click', () => onToggle?.(!open));
    body.id = bodyId;
    body.hidden = !open;
    section.append(head, body);
    return section;
}
