/* NPC State Delta dossier screens part: the width switch lines built from the pane minimums (two panes, three panes). */
import { PANE_HERO_MIN, PANE_HERO_SLIM_MIN, PANE_SECTION_MIN, PANE_TILES_MIN } from './pane-minimums.js';

export const PANE_SECTION_WIDE_MIN = 420; // a section pane at the width three panes are given
// Two panes (dial pane beside the tiles or a section): 250 + 370.
export const TWO_PANE_MIN = PANE_HERO_MIN + PANE_SECTION_MIN;
// Three panes (dial pane, tiles and a section): 230 + 290 + 420.
export const THREE_PANE_MIN = PANE_HERO_SLIM_MIN + PANE_TILES_MIN + PANE_SECTION_WIDE_MIN;
