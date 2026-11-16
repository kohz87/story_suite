// The level terms of a set of numbers: whether it is levelled, its divisor, a party member's class term and the level cap.
import { LEVEL, LEVEL_CAP_SETTING, levelCapOf } from '../names.js';
import { levelBonus } from '../formula.js';

// LEVELS (2.17.0, names.js LEVEL): a set of numbers may carry `levelDivisor` (3..8): then the roll's term for a party member is levelBonus(level, divisor) in place
// of classWeight × Soul Class, and a foe's is its base + levelBonus(foe level, divisor). A set without it (every roll made before) is read exactly as before.
// It is not one of RULE_KEYS / STANDARD_RULE_KEYS (the Custom rows of the settings window keep their count); normalize keeps it, last, when it is valid.

/** Whether numbers are the level-based ones (a roll made from 2.17.0 on). */
export const hasLevels = rules => Number.isInteger(rules?.levelDivisor);

/** A level divisor: a whole number from LEVEL.minDivisor to LEVEL.maxDivisor, else null. */
export const divisorOf = value => (Number.isInteger(value) && value >= LEVEL.minDivisor && value <= LEVEL.maxDivisor ? value : null);

/**
 * What a party member adds to a roll under `rules` besides the stat and the rank: `{ classValue, classBonus }`. Levelled numbers: the character's level and
 * levelBonus(level, divisor). Earlier numbers: the Soul Class and classWeight × it.
 */
export const classTerm = (rules, character) => (hasLevels(rules)
    ? { classValue: character.level, classBonus: levelBonus(character.level, rules.levelDivisor) }
    : { classValue: character.soul, classBonus: rules.classWeight * character.soul });

// ---- the level cap -----------------------------------------------------------------------------------------------------

/**
 * The highest level a new character may reach: the story's pack asks for one (`packCap`, a whole number 1..99), else the reader's setting `rpgLevelCap`, else 99.
 * It is the default of the Character block's `cap` field (a made character keeps its own).
 */
export const levelCapFor = (values, packCap = null) => levelCapOf(packCap) ?? levelCapOf(values?.[LEVEL_CAP_SETTING]) ?? LEVEL.max;
