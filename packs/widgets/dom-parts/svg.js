// Builds SVG elements.

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** An SVG element with attributes (values stringified; `class` is an attribute on SVG). */
export function s(doc, tag, attrs = {}) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
        if (value !== undefined && value !== null) node.setAttribute(name, String(value));
    }
    return node;
}
