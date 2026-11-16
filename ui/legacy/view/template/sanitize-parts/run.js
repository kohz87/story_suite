// Story Suite v2: sanitizing template HTML end to end: parse then filter, or the strict string-to-string form.

import { parseHtml, serializeHtml } from '../html.js';
import { filterNodes } from './filter.js';

/** Parse and filter template HTML: `{ nodes, warnings }`. */
export function sanitizeNodes(html) {
    const warnings = [];
    return filterNodes(parseHtml(html, warnings), warnings);
}

/** The strict allow-list as a DOMPurify-shaped function: HTML text in, safe HTML text out. */
export function strictSanitize(html) {
    return serializeHtml(sanitizeNodes(html).nodes);
}
