// The Fight tab (approved mockup, section 5): the Foes block's own tab while the feature is on. It shows only while any foe slot
// is filled. A header "Fight · <place>" with the note about automatic rolls and two pills ("Exchange N" from the latest rolls,
// "N foes · M down"), the turn order row (Standard: rolled at the start of the fight, drawn from the latest rolls' record), a card per foe (name, level pill "Rank F · Lv 7", five-cell health bar, greyed when Down; a tap on the bar or its pencil edits
// the foe's health, a choice of the stage words saved through `dm.set`, as on the Party card; names are edited in Settings → Blocks), a card per
// character with the three stage bars, and "Last exchange": the latest reply's battle-log panel with a button that scrolls the chat to
// that reply and closes the game view. Wide screen a grid, phone a stack.
// Every node is built with createElement and textContent.
// Public face: re-exports its parts.

export { readFight, hasFoes } from './fight-parts/data.js';
export { FIGHT_WIDGET, FIGHT_SCREEN_ID, createFightScreen } from './fight-parts/screen.js';
export { createFightWidget } from './fight-parts/widget.js';
