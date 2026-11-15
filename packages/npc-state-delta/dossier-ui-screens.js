/* NPC State Delta dossier screens: the pure screen state machine (library | board | profile | section:n), back and Esc order,
   sideways swipe steps, the dossier's own width switch (one column, or two panes) and the desktop pane layout. No markup here; the screen renderers draw each screen. Public face: re-exports its parts. */
export { PANE_HERO_MIN, PANE_HERO_SLIM_MIN, PANE_TILES_MIN, PANE_SECTION_MIN } from './dossier-ui-screens-parts/pane-minimums.js';
export { PANE_SECTION_WIDE_MIN, TWO_PANE_MIN, THREE_PANE_MIN } from './dossier-ui-screens-parts/pane-switch-lines.js';
export { SWIPE_MIN_PX, swipeStep, bindSwipe } from './dossier-ui-screens-parts/swipe.js';
export { SECTION_KEYS, normalizeSection, parseScreen } from './dossier-ui-screens-parts/parse-screen.js';
export { formatScreen, layoutFor, screenSignature } from './dossier-ui-screens-parts/screen-view.js';
export { createScreenState, showScreen, openNpc, openSection } from './dossier-ui-screens-parts/screen-state.js';
export { goBack, setSection, stepSection, escapeAction } from './dossier-ui-screens-parts/screen-moves.js';
export { panelWidth, isNarrowWidth, isNarrow, observedWidth } from './dossier-ui-screens-parts/panel-width.js';
