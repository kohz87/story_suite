// ss.tiers (view/glass-*.css): the tiered grid. Tiers top to bottom, each a label over a glass card of ss.tile
// tiles, and a connector (a dot and a line) joining one tier to the next: a skill ladder (Basic, Advanced,
// Finisher), a bag by kind, a crafting chain.
//
// With `onSelect`, an unlocked tile is a button: a choice runs that command with `{ tiers: <tile id> }` (read a
// skill, manage an item; never a story action, F95/F96) and shows as chosen at once; a screen that redraws with
// another `selected` wins. The tiles are ss.tile widgets (glass.js), so each speaks as a tile does.
//
// Built with createElement and textContent only, like every standard widget (dom.js).
//
// Public face: re-exports its parts.

export { TIER_MAX, TILE_MAX, tierList } from './tiers-parts/list.js';
export { COLUMNS_MAX, tiers } from './tiers-parts/widget.js';
