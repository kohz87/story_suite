// Builds DOM elements (HTML nodes, buttons) and marks them with a data attribute.

import { cutAt } from '../../../../text.js';

/** The document an element lives in (a widget may be drawn into another window's document). */
export function docOf(el) {
    return el?.ownerDocument ?? globalThis.document;
}

/** An HTML element with an optional class and text. */
export function h(doc, tag, className = '', text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
    return node;
}

/** A `type="button"` button with a class, a label and a click handler. */
export function button(doc, label, className, click) {
    const node = h(doc, 'button', className, label);
    node.setAttribute('type', 'button');
    node.addEventListener('click', click);
    return node;
}

/** A `data-*` value from data: a short plain string, or the attribute is removed. */
export function setData(node, name, value) {
    const text = value === undefined || value === null ? '' : cutAt(String(value), 64);
    if (text) node.setAttribute(`data-${name}`, text);
    else node.removeAttribute(`data-${name}`);
}
