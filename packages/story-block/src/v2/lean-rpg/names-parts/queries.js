// Names: the fight and practice step names and the rolls and foes queries.

/** The query for the chat index of the latest reply that touched the Foes block (-1: none); the stale-foes rule reads it (precall.js). */
export const FOES_TOUCH_QUERY = 'rpg.foesTouched';

/** The step after a reply's lines that gives the party its XP for a won fight (fight.js); also the kind of its replay guard. */
export const FIGHT = 'rpg.fight';

/** The step after a reply's lines that gives practice for the skills its rolls used (practice.js); also the kind of its replay guard. */
export const PRACTICE_STEP = 'rpg.practice';
/** The query B reads a reply's rolls through: `rpg.rolls { index? }` → { receipt, result, summary } | null (the head reply by default); the practice step asks it too. */
export const ROLLS_QUERY = 'rpg.rolls';
