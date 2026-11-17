// Pack format 3: the format number the suite reads, and the parts of older packs it no longer reads.

// The newest pack format this suite understands. A pack without `format` is read as format 2; one with a newer number is refused.
export const PACK_FORMAT = 3;
export const PACK_FORMAT_DEFAULT = 2;
// Content kinds nothing reads any more: accepted with a warning and left out of the normalized pack.
export const IGNORED_KINDS = Object.freeze(['creatures', 'shops', 'recipes', 'quests', 'races', 'talents', 'presets', 'terms', 'ranks', 'crafts']);
// Top-level fields nothing reads any more (the new view draws no pack layouts or screens): accepted with a warning, left out.
export const IGNORED_TOP_FIELDS = Object.freeze(['layouts', 'screens']);
