// The layout node a data module's screen uses to show its own fields the way a block shows them (screens/block-layouts.js draws it):
// `{ type: "story-block.fields", props: { module, field | fields, as?, title?, names?, labels?, units?, tones? } }`.
//   as "map" (the default for a map field): a map of numbers, a header, a row with a value and a bar for each key, the unset ones folded away;
//   as "record": a small card of label/value lines. `field` is a map field; `fields` lists whole-number fields (a map) or any fields (a record).
//   names: { key: "Shown name" } for a map's keys; labels: { field: "Label" } for a record's lines; units: { field: "copper" } after a value;
//   tones: { field: { value: "good" | "warn" | "bad" | "accent" | "neutral" } } for a choice drawn as a chip.
//   tiles: true (a record only): the lines as small tiles in one row, no pencils; a choice is a plain word (amber for a "warn" tone), a short code a round badge.
// The stub below lets the checker and editableLayout accept the node; the real widget is registered by the host.
// Public face: re-exports its parts.
export { FIELDS_WIDGET, HEADING_WIDGET, FIELDS_PROPS, BLOCK_NODE_WIDGETS } from './fields-widget-parts/constants.js';
export { fieldsNodeProblems } from './fields-widget-parts/problems.js';
