// The level a foe group or a party member stands at, and the standing foe slots.

import { clampLevel } from '../levels.js';
import { levelOfClass } from '../formula.js';
import { whole } from './shared-values.js';

/** The level a foe group stands at: its `level`, else (an older Foes block) its class 1..9 as the level. */
export const foeLevel = foe => clampLevel(whole(foe?.level) ? foe.level : whole(foe?.class) ? levelOfClass(foe.class) : 1);
/** The level a party member stands at: their `level`, else (an older Character block) its Soul Class 1..9 as the level. */
export const memberLevel = character => clampLevel(whole(character?.level) ? character.level : whole(character?.soul) ? levelOfClass(character.soul) : 1);

/** The foe slots that are filled and not Down (their Health above 0). */
export const standingSlots = sheet => sheet.foes.filter(foe => foe.filled && foe.hurt > 0).map(foe => foe.slot);
