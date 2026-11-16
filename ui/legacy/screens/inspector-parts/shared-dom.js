// The small DOM builders (element, button, section card) shared by the Inspector's drawing parts.

export function el(doc, tag, className = '', text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
    return node;
}

export function button(doc, className, text, title) {
    const node = el(doc, 'button', `sb-insp-btn ${className}`, text);
    node.type = 'button';
    node.setAttribute('type', 'button');
    if (title) {
        node.setAttribute('title', title);
        node.setAttribute('aria-label', title);
    }
    return node;
}

// A section is a glass card (the look's `ss-glass`); its title is the section label.
export function section(doc, className, title) {
    const box = el(doc, 'section', `ss-glass sb-insp-card ${className}`);
    box.appendChild(el(doc, 'h4', 'ss-label sb-insp-card-title', title));
    return box;
}
