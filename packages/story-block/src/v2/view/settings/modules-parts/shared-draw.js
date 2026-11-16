// Small drawing helpers the Modules page shares: make a node, clean text and cut what other extensions give.

import { cutAt } from '../../../../../../../core/text.js';

export const h = (doc, tag, className = '', text = '') => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
    return node;
};
export const clean = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
// What other extensions give is shown cut: a name, a version, a description.
export const CUT = Object.freeze({ name: 60, version: 40, description: 300 });
export const clip = (value, max) => cutAt(clean(value), max);
