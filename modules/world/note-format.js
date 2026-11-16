// Story Director: the note's word limits and field formatting (pure).
//
// NOTE_PART_WORDS, the item separator, notePart, fieldOf and the part builder moved out of
// note.js; note.js re-exports the public names.
// Public face: re-exports its parts.
export { ITEM_SEPARATOR, NOTE_PART_WORDS } from './note-format-parts/constants.js';
export { fieldOf, notePart, part } from './note-format-parts/format.js';
