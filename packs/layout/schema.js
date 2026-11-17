// What a layout may contain: node types and their fields, theme tokens, limits, and the
// small value checks shared by the validator and the renderer.
//
// A layout is data from a pack (or a module) and is never trusted: no HTML, no script,
// Public face: re-exports its parts.

export { LIMITS, TONES, TEXT_VARIANTS, IMAGE_SIZES } from './schema-parts/limits.js';
export { TOKENS, NODE_TYPES } from './schema-parts/nodes.js';
export { isPlainObject, isBinding } from './schema-parts/shapes.js';
export { QUERY_NAME, COMMAND_NAME, WIDGET_NAME } from './schema-parts/names.js';
export { LAYOUT_ID, ICON, TOKEN_NAME } from './schema-parts/ids.js';
export { pathError, itemRef, getPath } from './schema-parts/paths.js';
export { imageUrlError, tokenValueError } from './schema-parts/values.js';
