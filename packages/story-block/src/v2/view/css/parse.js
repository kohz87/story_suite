// Shared CSS limits and tokenizing helpers for the screen stylesheet scoper: comments, items, top-level
// splits, escapes and at-rule names. These are syntax readers only; values and selectors are checked next.
// Public face: re-exports its parts.

export { MAX_AT_DEPTH, MAX_CSS_BYTES, bytes, cssDepth } from './parse-parts/limits.js';
export { DROPPED, GROUPS, SCOPE_ALIASES, atName } from './parse-parts/at-rules.js';
export { callArgs, decodeEscapes, splitTop, stripComments } from './parse-parts/text.js';
export { groupItems, readItems } from './parse-parts/items.js';
