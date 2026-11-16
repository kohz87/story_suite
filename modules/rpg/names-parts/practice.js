// Names: practice per use and where skill practice comes from.

import { ROLLS_SETTING } from './rolls.js';

/**
 * Practice by code (practice.js): each use of a skill in a reply's rolls (an act's or a check's skill, a defender's skill) gives the reader's setting
 * (`perUse` unless set, 1 to 5), summed per skill and held to `max` a reply (the same 1..20 the Skills block's practice line takes). A roll made from stage 50 on
 * carries the value in its payload (`practice`); a roll made before has none and gives no practice by code.
 */
export const PRACTICE = Object.freeze({ perUse: 3, minPerUse: 1, maxPerUse: 5, max: 20 });
/** The setting (Story Block's own bucket, Settings → RPG): the practice one use gives, 1 to 5 (3 unset). A roll records the value it was made with (`practice` in its payload). */
export const PRACTICE_SETTING = 'rpgPracticePerUse';
/** `value` as a practice per use: a whole number from 1 to 5, else null. */
export const practiceOf = value => (Number.isInteger(value) && value >= PRACTICE.minPerUse && value <= PRACTICE.maxPerUse ? value : null);

/** Skill practice comes only from rolled uses while the RPG is on and Rolls is automatic (the narrator's `practice-N` line is not offered and is refused). */
export const practiceFromRollsOnly = (rpgOn, values) => rpgOn === true && values?.[ROLLS_SETTING] !== 'off';
