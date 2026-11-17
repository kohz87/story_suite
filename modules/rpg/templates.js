// The RPG block templates (Character, Skills, Foes, Combat rules): data-module definitions that the block
// chooser offers while the RPG feature is on (Settings → Blocks → From a template). Each carries a `role`
// (see ROLES in index.js) and keeps the field keys the RPG reads. Stage fields are indexes (0 = empty) with
// `names` from STAGES; the level is a number 1–99 (stage 51; the Soul Class I–IX of earlier blocks is not in new templates) and ranks are numbers with names. The block engine adds three things these
// use: `names` and `prompt: false` on fields, and the `replyEnd` and `cards` lists. The Skills block's rank and practice
// are `edit: false` (they only move through play); SKILL_SETS are the New character wizard's built-in skill sets.
// Public face: re-exports its parts.
export { characterV1For } from './templates-parts/character.js';
export { skillsV1For, skillsV2For, grownSkills } from './templates-parts/skills.js';
export { FOE_COUNT_MAX } from './templates-parts/foes.js';
export { COMBAT_PROMPT_STANDARD } from './templates-parts/combat.js';
export { COMBAT_PROMPT_V1 } from './templates-parts/v1-rules.js';
export { SKILL_SETS } from './templates-parts/skill-sets.js';
export { CHOOSER_TEMPLATES, STANDARD_TEMPLATES, STANDARD_TEMPLATES_EIGHT } from './templates-parts/catalogue.js';
