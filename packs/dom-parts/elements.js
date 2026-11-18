// Building DOM nodes: an element, an icon button, a click guard and the tab list a card takes.

// `doc`: the document to make it in (a page that draws into another one passes its own).
export function el(tag, className = '', text = '', doc = globalThis.document) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
    return node;
}

export function button(className, { text = '', title = '', icon = '' } = {}) {
    const node = el('button', className, text);
    node.type = 'button';
    if (title) {
        node.title = title;
        node.setAttribute('aria-label', title);
    }
    if (icon) {
        const glyph = el('i', `fa-solid ${icon}`);
        glyph.setAttribute('aria-hidden', 'true');
        node.prepend(glyph);
    }
    return node;
}

// Tabs as a card or the sidebar takes them: each with an id (trimmed) and a render
// function, the first of each id kept.
export function normalizeTabs(tabs) {
    const seen = new Set();
    const out = [];
    for (const tab of Array.isArray(tabs) ? tabs : []) {
        const id = String(tab?.id ?? '').trim();
        if (!id || seen.has(id) || typeof tab?.render !== 'function') continue;
        seen.add(id);
        out.push({ ...tab, id });
    }
    return out;
}

// Clicks inside the card must not reach SillyTavern's message handlers (or a host
// card's delegated listeners), which would treat them as clicks on the message.
export function stop(handler) {
    return event => {
        event.stopPropagation();
        handler(event);
    };
}
