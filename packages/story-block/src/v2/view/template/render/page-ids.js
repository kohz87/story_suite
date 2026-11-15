// Story Suite v2: how a template's ids and names are drawn on the shared page (moved out of render.js unchanged). Every `id` is
// prefixed with its screen's (`ss-t-<screen>-`), the attributes that point at ids follow, each further copy of a screen drawn at the
// same time adds a copy mark, class lists lose the reserved classes and reserved control names go. `COPIES` is the one table of copy
// numbers drawn now; only takeCopy and freeCopy touch it.
// Public face: re-exports its parts.
export { idPrefixOf } from './page-ids-parts/prefix.js';
export { takeCopy, freeCopy } from './page-ids-parts/copies.js';
export { PAINT_REFS, pageValue } from './page-ids-parts/value.js';
