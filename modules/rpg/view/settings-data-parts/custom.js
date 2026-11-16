// The Custom numbers as stored, or the numbers of the difficulty now.

import { STANDARD_SETTING, normalizeStandard, rulesFromSettings, difficultyOf } from '../../rules.js';

/**
 * The Custom numbers as stored (each held to its range), else the numbers of the difficulty now (so a switch to Custom starts where the reader is).
 * They live in `rpgStandard`.
 */
export const customOf = (values, pack = null) => normalizeStandard(values?.[STANDARD_SETTING] ?? (difficultyOf(values) === 'custom' ? null : inForce(rulesFromSettings(values, pack))));
// (The level divisor, 3 to 8, is in the Custom numbers only when the reader typed one: a switch to Custom starts from the numbers of the difficulty.)
const inForce = ({ levelDivisor: _divisor, ...rest }) => rest;
