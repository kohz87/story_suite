/* NPC State Delta relationship map focus and look: pure helpers for "Focus" on one person (which nodes and
   bonds stay lit, each tied person's relation word and tone, the "Focus: Name ✕" chip) and the markup of the
   map's rings, faces, bond lines and person card. Layout and bond resolution stay in relationship-map-core.js.
   No host or state access; the markup is strings, portraits go through the dossier's portrait refs. Public face: re-exports its parts. */

export { FOCUS_TONES, FOCUS_STATES } from './relationship-map-focus-parts/focus-constants.js';
export { relationWord, tagWord, localBondTone, bondToneOf } from './relationship-map-focus-parts/bond-words.js';
export { focusChip, buildFocusModel } from './relationship-map-focus-parts/focus-model.js';
export { faceTone, bondLine, mapSvgHtml, mapNodeHtml } from './relationship-map-focus-parts/map-markup.js';
export { selectedTies, cardNumberItems, cardNumbersLine } from './relationship-map-focus-parts/card-ties.js';
export { possessiveWord } from './dossier-ui-view-model.js';
export { mapCardHtml, mapKeyLine } from './relationship-map-focus-parts/card-html.js';
export { focusStyles } from './relationship-map-focus-parts/focus-styles.js';
