// Build ordinary data-module definitions from the small in-chat editor; the interpreter is shared with packs.
// Public face: re-exports its parts.
export { defaultTone, parseNames, namesText } from './block-builder-parts/names.js';
export { uniqueBlockSlug, partKey } from './block-builder-parts/slugs.js';
export { blockKindCount, entriesTooBig } from './block-builder-parts/limits.js';
export { buildBlock } from './block-builder-parts/build.js';
export { blockDraft, editableBlockDraft } from './block-builder-parts/draft.js';
