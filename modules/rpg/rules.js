// The numbers a roll is made with, and the odds they give (Settings → RPG, mockup section 6).
//
// A roll uses the Standard formula's numbers (formula.js): the foe's base and class weight, what a Soul Class (or level) adds, how far short a total may
// fall and still be "success at a cost", the margin that makes a round decisive, the most exchanges one reply may hold, and the creation numbers. Gentle and
// Harsh move the foe's base; Custom is what the reader typed (each number held to its range). Classic rules are gone: a payload with no `formula` replays as Standard.
//
// REPLAY RULE: the numbers in force are chosen here, once, when the roll is planned (precall.js), and travel inside the
// `rpg.resolve` payload (`rules`). The payload is what a Re-read, a rebuild and a reload run again, so a roll is always
// made again with the numbers it was first made with, never with today's settings. Changing a setting changes new rolls only.
//
// The Standard stat formula's numbers (`formula: 'standard'` plus the rest) travel in the same payload.
// Public face: re-exports its parts.
export { hasLevels, divisorOf, classTerm, levelCapFor } from './rules-parts/levels.js';
export { DIFFICULTY_SETTING, STANDARD_SETTING, STANDARD_RULE_KEYS, STANDARD_RANGES } from './rules-parts/numbers.js';
export { DIFFICULTIES, STANDARD_PRESETS, STANDARD_FORMULA, STANDARD } from './rules-parts/presets.js';
export { EARLIER_RULES, isStandard, normalizeRules, normalizeStandard } from './rules-parts/normalize.js';
export { packRulesOf, difficultyOf, rulesFromSettings, packInForce } from './rules-parts/settings.js';
export { sameRules, presetOf } from './rules-parts/compare.js';
