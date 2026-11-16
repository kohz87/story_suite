// What the RPG screens read from the story state: the Character, Skills and Foes blocks (custom blocks whose
// definition has a `role`, see ROLES in ../index.js), as plain records the Party tab, the Spend points sheet, the
// battle log and the "Changed this reply" lines draw from. Pure: no DOM. Field keys are the ones COMMON.md fixes
// (`who`, `health`, `mana`, `stamina`, the seven stats, `points`, `soul`, `xp`, `alive`; `skillN` / `rankN` /
// `practiceN`; `foeN` / `countN` / `classN` / `hurtN`). Stored values are numbers; the words come from the field's
// `names` when it has them, else from the defaults below. A bar field with `blocks` (the Standard formula, ../blocks.js) stores the blocks left;
// its size comes from the stats (the foe's class) and its stage word is spread over that size; every other bar reads as it always did.
// Public face: re-exports its parts.

export { FOE_SLOTS, foesOf, readFoes } from './party-data-parts/foes.js';
export { BARS, MAX_STAGE, stageMax, stageTone } from './party-data-parts/stages.js';
export { nameOf, soulName, rankName, stageWord } from './party-data-parts/words.js';
export { levelOf, levelText, xpLine } from './party-data-parts/levels.js';
export { blockBar, growthText, barOptions } from './party-data-parts/bar-text.js';
export { rpgBlocks, hasCharacters } from './party-data-parts/blocks.js';
export { skillsOf } from './party-data-parts/skills.js';
export { readParty } from './party-data-parts/party.js';
