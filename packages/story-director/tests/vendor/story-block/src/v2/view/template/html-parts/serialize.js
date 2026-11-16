// Turns parsed nodes back into escaped HTML text.

import { VOID } from './tags.js';

const escapeText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const escapeAttr = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');

/** Nodes back to HTML text (escaped; void elements without an end tag). */
export function serializeHtml(nodes) {
    return nodes.map(node => {
        if (node.type === 'text') return escapeText(node.text);
        const attrs = node.attrs.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
        if (VOID.has(node.tag) && !node.svg) return `<${node.tag}${attrs}>`;
        if (node.svg && !node.children.length) return `<${node.tag}${attrs}/>`;
        return `<${node.tag}${attrs}>${serializeHtml(node.children)}</${node.tag}>`;
    }).join('');
}
