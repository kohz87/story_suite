// Screen selector handling: scoping each selector list to the screen root, prefixing drawn ids, and checking
// whether a selector reaches past the root. Pure; packs use sheetEscape through the css.js facade.
// Public face: re-exports its parts.

export { prefixIds, scopeSelector, scopeSelectorList } from './selectors-parts/scope.js';
export { selectorEscape, sheetEscape } from './selectors-parts/escape.js';
