// Story Suite v2: the settings host's field controls (moved out of host-ui.js unchanged; host-ui.js re-exports the public ones).
// Builds the DOM for one settings field (bool, int, choice, text, a list of {…} as lines or as items), reads a value back,
// and groups a module's fields. Every node is built with textContent; `doc` is the document to build in.
// Public face: re-exports its parts.

export { el, button, humanize, fold } from './controls-parts/dom.js';
export { emptyValue, readInt } from './controls-parts/values.js';
export { listTextFields, listToLines, linesToList } from './controls-parts/list-lines.js';
export { fieldReadOnly, rowValue } from './controls-parts/row-value.js';
export { fieldRow } from './controls-parts/field-row.js';
export { groupFields } from './controls-parts/groups.js';
