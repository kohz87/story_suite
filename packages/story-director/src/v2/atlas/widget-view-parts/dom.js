// Small DOM element, button, and icon builders for the map widget.

export function h(doc, tag, cls = '', text = '') {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
}

export function button(doc, cls, text, title) {
    const node = h(doc, 'button', cls, text);
    node.setAttribute('type', 'button');
    if (title) {
        node.setAttribute('title', title);
        node.setAttribute('aria-label', title);
    }
    return node;
}

const FA = /^fa(?:-[a-z0-9]+)+$/;
export function icon(doc, name) {
    const node = h(doc, 'i', `fa-solid ${FA.test(String(name)) ? name : 'fa-location-dot'}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}
