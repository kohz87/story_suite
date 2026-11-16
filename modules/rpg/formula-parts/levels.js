// The level terms: what a level adds to a roll and the mapping between a Soul Class and a level.
import { num } from './shared-num.js';

/**
 * What a level adds to a roll (names.js LEVEL): floor(level / divisor), the divisor 5 by default (3 to 8 when the reader's Custom numbers say so). A level is
 * held to 1..99 and a divisor outside 3..8 reads as 5.
 */
export const levelBonus = (level, divisor = 5) => Math.floor(Math.max(1, Math.min(99, num(level))) / (Number.isInteger(divisor) && divisor >= 3 && divisor <= 8 ? divisor : 5));

/** The level a Soul Class stands for where only the class is known (a character block made before levels): class n → level 10n − 5 (I → 5 … IX → 85). */
export const levelOfClass = soul => 10 * Math.max(1, Math.min(9, num(soul))) - 5;

/** The Soul Class (1..9) a level stands for where only a class is asked (the `+ party` line's class): the inverse of levelOfClass (10n - 5), floor(level / 10) + 1 (levels 1-9 are class I, 10-19 II ... 80+ IX). */
export const classOfLevel = level => Math.max(1, Math.min(9, Math.floor(Math.max(1, num(level)) / 10) + 1));
