// DOM primitives for the Dossiers part: the drawer flags, the shared pane class, text-only element helpers and the meter bar.
// These helpers never parse text as markup; callers pass text through textContent.
// Public face: re-exports its parts.

export { PLACEHOLDER_FLAG, HIDDEN_FLAG, PANE_CLASS } from './dom-parts/flags.js';
export { elementOf } from './dom-parts/element.js';
export { meterBarNode } from './dom-parts/meter-bar.js';
