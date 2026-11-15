// Story Director v2, part **keypeople**: basic type guards and name-key normalization.

import { lineKey } from '../../../changes.js';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInt = value => Number.isSafeInteger(value);

/** The identity of a name (`lineKey`): lower case, punctuation squashed. '' for a name with no letters or digits. */
export const keyOf = name => lineKey(String(name ?? ''));
