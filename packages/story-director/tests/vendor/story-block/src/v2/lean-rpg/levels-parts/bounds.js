// Levels: the level range and holding a level to it.

import { LEVEL } from '../names.js';
import { whole } from './shared-guards.js';

/** A level runs from 1 to 99 (names.js LEVEL: the character's `level`, a foe's `level{n}`, a pack's rank bands and level cap). */
export const LEVEL_MIN = LEVEL.min;
export const LEVEL_MAX = LEVEL.max;

/** A level held to 1..99 (a number that is not whole, or not a number, is 1). */
export const clampLevel = value => (whole(value) ? Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, value)) : LEVEL_MIN);
