// Small node helpers shared by the marker parts: a node's children, whether a node is blank, and a text node's text.

export const nodesOf = node => Array.from(node?.childNodes ?? []);
export const blank = node => (node.nodeType === 3 ? !String(node.data ?? node.textContent ?? '').trim() : node.tagName === 'BR');
export const textOf = node => String(node.data ?? node.textContent ?? '');
