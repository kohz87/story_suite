// The building blocks of Story Suite's look (view/glass-*.css) as widgets, for templates and layouts:
//
// * ss.tile: an icon in a rounded square with a label under it, a number badge (a skill's level, a stack's
//   count; `countStyle: 'corner'` puts it in the corner, as a bag does), a tick (`state: 'ready'`) or a
//   lock (`state: 'locked'`, dimmed), a ring in a tone or a rarity, and `selected`. With `onSelect` it is a
//   button that runs that command with `{ tile: <id> }` (choosing a skill to read, an item to manage;
//   never a story action, F95/F96), pressed while `selected`; a locked tile is not a button.
// * ss.bar: a labelled progress bar (HP 50 / 82), `kind` hp, mp, sp or exp for the suite's bar colours
//   (else `tone`), the fill a custom property (`--ss-fill`, 0…1).
// * ss.status: a status effect as an icon in a tinted square with the time it has left in the corner:
//   "2t" (turns or rounds), "40m", "3h", "2d" (story minutes), "∞" (no set end); spoken in full words.
// * ss.pill: a short text in a pill (solid, soft or outline), with an optional icon.
//
// Built with createElement and textContent only, like every standard widget (dom.js).
// Public face: re-exports its parts.

export { GLASS_TONES, setGlassTone } from './glass-parts/tones.js';
export { TILE_STATES, tile, tileSpoken } from './glass-parts/tile.js';
export { BAR_KINDS, bar, barRatio } from './glass-parts/bar.js';
export { STATUS_UNITS, status, leftText, leftSpoken } from './glass-parts/status.js';
export { PILL_STYLES, pill } from './glass-parts/pill.js';
