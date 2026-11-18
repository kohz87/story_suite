// Story Suite v2: whether an element may have an attribute of a given name.

import { GLOBAL_ATTRS, ATTRS, SVG_ATTRS } from './attr-tables.js';

/** Whether an element may have an attribute of this name (values are checked separately). */
export function attrAllowed(tag, svg, name) {
    const lower = name.toLowerCase();
    if (lower.startsWith('on') || ['action', 'formaction', 'srcdoc', 'srcset', 'ping', 'background', 'is', 'xmlns:xlink'].includes(lower)) return false;
    if (lower.startsWith('data-ss-')) return false;
    if (lower.startsWith('data-')) return /^data-[a-z0-9-]+$/.test(lower);
    if (lower.startsWith('aria-')) return /^aria-[a-z]+$/.test(lower);
    if (GLOBAL_ATTRS.has(lower)) return true;
    if (svg) return SVG_ATTRS.has(name);
    return (ATTRS[tag] ?? []).includes(lower);
}
