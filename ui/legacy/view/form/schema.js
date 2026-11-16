// The settings schema as the form engine reads it (view/form/): what kind of control each field gets, the plain-
// words messages, and the pure helpers shared with the settings overlay (host-ui.js), which stays the one place
// that knows how a list reads as lines, which groups a schema falls into and when a row is read-only. The engine
// takes them from there instead of copying them, so the two cannot disagree while the overlay still ships.
//
// The schema is the one the registry holds (`registry.settingsDefs()`, SPEC §6): `{ key: field }` with a field
// `{ type: bool | int | choice | text | list | profile, label, help, min, max, options, of, multiline, form, group,
// readOnly, shows, feature }` (a string is shorthand for its type, an array for a choice's options).
// Public face: re-exports its parts.

export { FIELD_TYPES, SETTING_LIST_ROWS, fill, normalizeField } from './schema-parts/registry-names.js';
export { SETTINGS_TEXT, emptyValue, fieldReadOnly, readInt } from './schema-parts/host-values.js';
export { groupFields, linesToList, listTextFields, listToLines } from './schema-parts/host-rows.js';
export { rowValue } from './schema-parts/host-row-value.js';
export { FIELD_KINDS, fieldKind } from './schema-parts/kinds.js';
export { FORM_TEXT, changeNote } from './schema-parts/messages.js';
export { humanize, labelOf, matchesSearch, optionsOf } from './schema-parts/labels.js';
