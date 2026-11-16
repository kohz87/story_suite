// The limits of a foe opening: most foes in a plan entry, most in a recorded one, longest name and longest rank word.
import { FOE_COUNT_MAX } from '../templates.js';

export const OPEN_MAX_COUNT = 12;
// What a recorded opening may hold: the pre-check's packs ("4 scores of rats") run to the Foes block's own count maximum; the old planner's vetOpen still holds its own entries to OPEN_MAX_COUNT.
export const OPEN_RECORD_MAX_COUNT = FOE_COUNT_MAX;
export const OPEN_MAX_NAME = 40;

export const RANK_MAX = 12;
