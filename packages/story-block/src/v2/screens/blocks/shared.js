// The Blocks page's words and small format helpers (moved out of screens/blocks.js unchanged): the singular/plural
// count name, the Show as value and the words under a block's name. The page imports them; the card view imports S.
// Public face: re-exports its parts.
export { S, P } from './shared-parts/words.js';
export { plural, showValue } from './shared-parts/format.js';
export { metaOf } from './shared-parts/meta.js';
