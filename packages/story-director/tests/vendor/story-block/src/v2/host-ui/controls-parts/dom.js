// The settings controls' DOM basics: build an element, a button, a fold, and turn a key into a readable name.

export function el(doc, tag, className = '', text = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
    return node;
}

export function button(doc, className, text, title = '') {
    const node = el(doc, 'button', className, text);
    node.type = 'button';
    if (title) {
        node.title = title;
        node.setAttribute('aria-label', title);
    }
    return node;
}

export const humanize = key => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, char => char.toUpperCase());

// A fold: `details` with its summary (title, then a quiet hint). The chevron is CSS (host.css), so the
// summary's text is only the title and the hint. `className` tells the top folds from the sub-folds.
export function fold(doc, key, title, hint = '', className = 'story-suite-fold') {
    const details = el(doc, 'details', className);
    details.dataset.fold = key;
    const summary = el(doc, 'summary');
    summary.appendChild(el(doc, 'b', '', title));
    if (hint) summary.appendChild(el(doc, 'small', '', hint));
    details.appendChild(summary);
    const body = el(doc, 'div', `${className}-body`);
    details.appendChild(body);
    return { details, body };
}
