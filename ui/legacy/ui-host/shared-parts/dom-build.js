// Element builders: makes a DOM node with a class and text, and an icon button.

export function el(doc, tag, className = '', text = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

export function iconButton(doc, className, iconName, label, title = label) {
    const node = el(doc, 'button', `menu_button ${className}`);
    node.type = 'button';
    node.title = title;
    node.setAttribute('aria-label', title);
    const glyph = el(doc, 'i', `fa-solid ${iconName}`);
    glyph.setAttribute('aria-hidden', 'true');
    node.append(glyph, el(doc, 'span', 'story-suite-label', label));
    return node;
}
