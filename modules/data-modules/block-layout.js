// What the block editor knows about how a block can be drawn: which of the three layouts (List of cards, Numbers with bars, Card of fields) fit the shape
// of the fields, which one to suggest and why, which parts of a List of entries play the card roles, and example values for the preview. Pure functions over
// the editor's draft (block-builder.js); nothing here is stored except what the author picks.
// Public face: re-exports its parts.
export { LAYOUTS, TONES, layoutShape } from './block-layout-parts/layout-fit.js';
export { cardRoles, statusTones } from './block-layout-parts/card-roles.js';
export { exampleValues } from './block-layout-parts/example-values.js';
