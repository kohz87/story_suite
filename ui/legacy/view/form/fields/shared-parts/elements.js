// The form engine's small element helpers: a plain element and a button.

function h(doc, tag, className = '', text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
    return node;
}
const button = (doc, className, label) => {
    const node = h(doc, 'button', className);
    node.setAttribute('type', 'button');
    if (label) node.setAttribute('aria-label', label);
    return node;
};

export { button, h };
