// The versions of the roll record and dice scheme, and the claim key of a roll.
export const RESULT_VERSION = 1;
/** The version of the dice scheme a payload asks for (`dice` in the payload of `rpg.resolve`): 2 = dice per action position. */
export const DICE_VERSION = 2;

export const claimKey = key => `rpg:resolve:${key}`;
