// What the RPG settings page reads from the story, as plain data (no DOM): the chat's Combat rules block, the text it is reset
// to, the definition a changed text is saved as, and the odds for the reader's own character under some numbers. The page (settings.js) draws them.
// Public face: re-exports its parts.

export { COMBAT_MAX, COMBAT_DEFAULT, combatTemplate } from './settings-data-parts/combat-text.js';
export { combatBlock, withPrompt } from './settings-data-parts/combat-block.js';
export { customOf } from './settings-data-parts/custom.js';
export { oddsView, soulLabelFor } from './settings-data-parts/odds.js';
