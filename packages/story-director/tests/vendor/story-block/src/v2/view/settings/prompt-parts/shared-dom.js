// The small DOM and number helpers the Prompt card's parts share.

export const el = (doc, tag, className = '', text = '') => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
    return node;
};
export const num = n => Number(n).toLocaleString('en-US');
