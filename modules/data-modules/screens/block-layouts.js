// How a block (or a data module's screen) draws its values, by the shape of the data (BLOCKS-UI, USER 4 Nov):
//   * a list of records (an `entries` field read through the block's `roles`): compact cards, a title and a status
//     chip, the description clamped to 2 lines with More, the current step with an icon; the open ones first, the others under "Finished (n)";
//   * a map of numbers (a map field of whole numbers, or several number fields): a header, a row with a value and a bar for each key, highest
//     first; the ones still at their default under "Not known yet (n)"; one pencil column;
//   * a record of fields: a card of label/value lines.
// Pure DOM building from plain data (createElement and textContent only); the editors are the editable widget's, and every change is one dm.set.
// Public face: re-exports its parts.
export { statusTone, drawCards } from './block-layouts-parts/cards.js';
export { entriesRoles, drawEntries } from './block-layouts-parts/entries.js';
export { drawNumberMap, numberRows } from './block-layouts-parts/number-map.js';
export { drawRecordCard } from './block-layouts-parts/record-card.js';
export { renderBlockPreview, barFields, drawShapes } from './block-layouts-parts/preview.js';
