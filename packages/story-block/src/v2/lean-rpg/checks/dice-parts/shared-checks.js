// Small checks and the rules normaliser shared by the dice payload and record parts.

import { LEVEL } from '../../names.js';
import { normalizeRules } from '../../rules.js';

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const inRange = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

/** The numbers a check is worked with, from the numbers in force: the level term's (every check is a levelled one), and the margins. */
export const rulesOf = value => {
    const full = normalizeRules(value);
    return { levelDivisor: full.levelDivisor ?? LEVEL.divisor, classWeight: full.classWeight, costMargin: full.costMargin, decisiveMargin: full.decisiveMargin };
};
