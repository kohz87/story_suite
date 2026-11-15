// The inventory domain's equipment and condition handlers (moved out of domains/inventory.js unchanged; inventory.js re-exports every public
// name): reading the party, wearing and mending a piece, equipping, stowing, restoring and releasing a stack, and the story's wear words.
// Public face: re-exports its parts.

export { joinNames } from './wear-parts/names.js';
export { wear, repair } from './wear-parts/condition.js';
export { gearWear } from './wear-parts/gear-wear.js';
export { itemEquip } from './wear-parts/equip.js';
export { stow, restore, release } from './wear-parts/bound-gear.js';
export { STORY_WEAR, wearWord, storyWear } from './wear-parts/story-wear.js';
export { storyRepair } from './wear-parts/story-repair.js';
