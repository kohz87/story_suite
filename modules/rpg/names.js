// The RPG's shared names (re-exported by index.js, which is where the other pieces import them from).
// They live in a file of their own so the pieces that index.js imports can use them without an import cycle.
// Public face: re-exports its parts.

export { LEAN_RPG_FEATURE, RESOLVE, BOARD_SKILL, BOARD_SKILL_CARRY } from './names-parts/feature.js';
export { USE_ITEM, NOROLL, DICE, CHECK_STEP } from './names-parts/steps.js';
export { BOARD_HURTS, BOARD_CLEAR_FOES, BOARD_OPEN_FOES, BOARD_AWARD } from './names-parts/board-steps.js';
export { ROLL_KIND, CHECKS_SETTING, checksOn, CHECK_GRAMMAR } from './names-parts/checks.js';
export { FOES_TOUCH_QUERY, FIGHT, PRACTICE_STEP, ROLLS_QUERY } from './names-parts/queries.js';
export { PRACTICE, PRACTICE_SETTING, practiceOf, practiceFromRollsOnly } from './names-parts/practice.js';
export { ROLES, ROLES_WITHOUT_TAB } from './names-parts/roles.js';
export { STATS, STATS_V1, STATS_EARLIER, STATS_ANY } from './names-parts/stats.js';
export { STAGES, stageWord } from './names-parts/stages.js';
export { FORMULA, PACE, FOE_SLOTS, LIMITS } from './names-parts/rules.js';
export { ROLLS_SETTING, ROLLS, NOROLL_LIMIT_MAX, FIX_VERSION } from './names-parts/rolls.js';
export { AUTO_CAP_SETTING, AUTO_CAP, autoCapFrom, autoExchanges } from './names-parts/auto.js';
export { PRECHECK_SETTING, PRECHECK_LIMIT_MS, precheckOn } from './names-parts/precheck.js';
export { FIGHT_XP, BATTLE_MARKER } from './names-parts/fight-xp.js';
export { LEVEL, LV_VERSION, LEVEL_CAP_SETTING, levelCapOf } from './names-parts/level.js';
export { RANK_NAMES, CLASS_NAMES, USES, CREATION } from './names-parts/character.js';
export { JOIN_SETTING, JOINS, PARTY_MAX, PARTY_ACTIVE } from './names-parts/party.js';
