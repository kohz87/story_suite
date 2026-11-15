/* NPC State Delta dossier screens part: the minimum content widths of the dossier panes (the numbers the CSS container lines import). */

// The layout follows the dossier's OWN width (its panel, not the window). Every switch line is a sum of the minimum content widths
// that must fit side by side, never a device width. The CSS @container lines in dossier-ui-styles*.js import these same numbers.
export const PANE_HERO_MIN = 250; // the dial pane: the dial (210 at least) with its labels and padding
export const PANE_HERO_SLIM_MIN = 230; // the same pane with a section open beside it
export const PANE_TILES_MIN = 290; // the tiles: two columns of 140 and the gap and padding
export const PANE_SECTION_MIN = 370; // a section pane, narrowest (its clamp tops out at 420)
