// Mounts: the small DOM builders (node, button, icon) every mount draws with.

import { hasIcon, svgIcon } from '../../icons/index.js';

const DEFAULT_FA_ICON = 'fa-table-columns';

export function make(doc, tag, className = '', text = null) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== null) node.textContent = text;
    return node;
}

export function button(doc, className, text, title = null) {
    const node = make(doc, 'button', className, text);
    node.type = 'button';
    node.setAttribute('type', 'button');
    if (title) {
        node.setAttribute('title', title);
        node.setAttribute('aria-label', title);
    }
    return node;
}

export function icon(doc, name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (hasIcon(trimmed)) return svgIcon(doc, trimmed);
    const fa = !trimmed || trimmed.startsWith('ph-') ? DEFAULT_FA_ICON : name;
    const node = make(doc, 'i', `fa-solid ${fa}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}
