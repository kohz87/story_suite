// Text-only element helper for the Cast markup.

// DOM helpers for the Cast markup (text is set with textContent; nothing is parsed as markup).
export const elementOf = (doc, tag, className = '', text = null) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = String(text);
    return node;
};
