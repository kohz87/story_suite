// Names: the Rolls setting, its values, the old no-roll limit and the roll rules mark.

/**
 * The setting that decides whether the pre-call runs: `rpgRolls`, 'automatic' (default) or 'off'. It lives in
 * Story Block's own settings; the RPG settings page draws it.
 */
export const ROLLS_SETTING = 'rpgRolls';
export const ROLLS = Object.freeze(['automatic', 'off']);

/** The most seconds an old `rpg.noroll` record may name as the limit its planner was given (replay only: the planner and its setting are gone). */
export const NOROLL_LIMIT_MAX = 120;

/** A roll's rules mark (`fix` in `rpg.resolve`; 2: stage 65, 3: `then:`); none replays as before. */
export const FIX_VERSION = 3;
