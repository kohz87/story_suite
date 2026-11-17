// Settings → RPG (mockup section 6): a page of its own in the rail under Features, shown while the feature `story-block.rpg`
// is on. Cards:
//   Formula     the Standard roll table and the four numbers in force
//   Rolls       Story checks on / off, the Fight board's Auto cap and the pre-check's switch
//   Difficulty  Gentle / Standard / Harsh / Custom (`rpgDifficulty`), the Custom numbers (`rpgStandard`: thirteen) and the exact odds for the reader's own character under the numbers chosen, drawn
//               again as they change
//   Combat      the chat's Combat rules block's text (≤1200), saved as an edit of that block's definition, with Reset to the default
//   Companions  who join: Ask (the default) / Automatically / Off (`rpgJoin`, JOIN_SETTING): what the story's `+ party` line does (join.js)
// The numbers are only *chosen* here: a roll takes the numbers in force when it is planned and records them (rules.js), so
// nothing on this page can change a roll already made. Every node is built with createElement and textContent.
//
// The page's parts live in `settings/`: `constants.js` its words and Custom fields; `controls.js` the card, chips, field
// and number builders; `sections.js` Formula, Rolls, Levels, Companions and Gear; `difficulty.js` Custom numbers and odds;
// `combat.js` the Combat box and its saves; `page.js` the shared render closure.
// This file keeps the path, section record and public exports.
// Public face: re-exports its parts.

export { SETTINGS_MODULE, SECTION_ID } from './settings/constants.js';
export { renderRpgSettings } from './settings/page.js';
export { rpgSection } from './settings-parts/section.js';
