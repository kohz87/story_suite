// Small checks and the rules record shared by the dice payload and record parts.

import { V1 } from '../../combat/numbers.js';

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const inRange = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

/** The roll's version mark, recorded with the dice: a reply's dice record from before Combat Rules v1 has none and is not worked (a Re-read or a new reply is). */
export const ROLL_VERSION = 1;
/** What a check is worked with, recorded with the dice: the roll's version and the decisive margin. */
export const rulesOf = () => ({ roll: ROLL_VERSION, decisiveMargin: V1.decisiveMargin });
