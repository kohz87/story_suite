// A small, tolerant HTML reader for screen templates (no DOM needed, so it runs in Node tests and never
// touches innerHTML in the page). It follows the browser where templates are likely to differ: void
// elements, raw text elements (`script`, `style`, `textarea`, …), entity decoding, attribute names
// lowercased in HTML and case-restored in SVG, `/>` closing only void and SVG elements, implicit ends
// for `p`, `li`, `option`, `tr`, `td`/`th`, `dt`/`dd`, and a `tbody` put in when a `tr` sits in a table.
// Full HTML5 tree building (foster parenting, adoption agency) is out of scope; the docs ask for
// well-formed templates.
//
// Nodes: `{ type: 'element', tag, svg, attrs: [[name, value]], children }` and `{ type: 'text', text }`.
//
// Public face: re-exports its parts.

export { VOID } from './html-parts/tags.js';
export { decodeEntities } from './html-parts/entities.js';
export { MAX_DEPTH, tooDeep, parseHtml } from './html-parts/parse.js';
export { serializeHtml } from './html-parts/serialize.js';
