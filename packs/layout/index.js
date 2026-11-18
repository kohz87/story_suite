// Layouts (SPEC §9, MODULES §E): declarative screens bound to queries. A pack's layouts
// (and later every module's screens) are JSON trees of a few node types, checked by
// validateLayout and drawn by renderLayout into any element. tabFromLayout wraps one for
// the tab host. See docs/v2/LAYOUTS.md for the reference creators read.
// Public face: re-exports its parts.

export { renderLayout, showErrors } from './render.js';
export { validateLayout } from './validate.js';
export { LAYOUT_CSS, LAYOUT_STYLE_ID, ensureLayoutStyles } from './styles.js';
export { LIMITS, NODE_TYPES, TOKENS, TONES, imageUrlError } from './schema.js';
export { tabFromLayout } from './index-parts/tab-from-layout.js';
export { part } from './index-parts/part.js';
