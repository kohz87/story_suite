// Names: levels, their version mark and the level cap.

/**
 * Levels (2.17.0, replaces the Soul Class I–IX): a character has a level 1..`max`, `xpPerLevel` XP raise it by one (up to the character's own `cap`: the
 * pack's `rpg.levelCap` first, else the setting `rpgLevelCap`, else 99), every `pointEvery`-th level gives a point to spend. A roll adds `levelBonus(level, divisor)`
 * = floor(level / divisor) in place of the old weight × Soul Class (formula.js; `divisor` 5 by default, Custom `minDivisor`..`maxDivisor`). A roll made
 * with it carries `lv: 1` (LV_VERSION) and the divisor in its rules (`levelDivisor`); a roll without them replays with the Soul Class exactly as before.
 */
export const LEVEL = Object.freeze({ min: 1, max: 99, xpPerLevel: 100, xpMax: 9999, pointEvery: 3, divisor: 5, minDivisor: 3, maxDivisor: 8 });
/** The version of the roll term a payload asks for (`lv` in the payload of `rpg.resolve`): 1 = level bonus. */
export const LV_VERSION = 1;
/** The setting (Story Block's own bucket, Settings → RPG): the highest level a character can reach, 1 to 99 (99 unset). A pack's own cap comes first (levelCapFor: pack, then this setting, then 99). */
export const LEVEL_CAP_SETTING = 'rpgLevelCap';
/** `value` as a level cap: a whole number from 1 to 99, else null. */
export const levelCapOf = value => (Number.isInteger(value) && value >= LEVEL.min && value <= LEVEL.max ? value : null);
