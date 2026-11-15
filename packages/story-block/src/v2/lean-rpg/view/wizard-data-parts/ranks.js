// The ranks a skill may start at and their names.

import { RANK_NAMES } from '../../names.js';

/** The ranks a skill may start at: Novice, and Adept for at most one skill. */
export const START_RANKS = Object.freeze([0, 1]);

/** The rank a start value means ("Adept"). */
export const startName = start => RANK_NAMES[start] ?? RANK_NAMES[0];

/** The rank a draft's skill begins at: the file's rank after an import, else what was picked. */
export const rankOf = skill => (Number.isSafeInteger(skill?.rank) ? skill.rank : skill?.start ?? 0);
