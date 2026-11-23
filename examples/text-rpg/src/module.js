// The `text-rpg` module definition (SPEC §6): a rules module that shapes the narrator's prompt, through the public sdk only.
// Public face: re-exports its parts.

export { MODULE_ID, FEATURE, RPG_FEATURE, VERSION } from './module-parts/constants.js';
export { active, requireActive } from './module-parts/active.js';
export { textRpgModule } from './module-parts/definition.js';
export { renderNewCharacter } from './widget/new-character.js';
