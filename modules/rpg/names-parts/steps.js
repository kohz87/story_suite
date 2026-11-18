// Names: the prelude and step names for the item, dice and check records.

/** The consumables' own effect (owner 14 Nov): a bag item's pool restored. The inventory's Use on… and the story's used line call it when no other module answers `item.use`. */
export const USE_ITEM = 'rpg.useItem';

/** The prelude that rolls a reply's three story-check dice and records them with it (checks/dice.js; the narrator's note is drawn from it, cue.js). */
export const DICE = 'rpg.dice';
/** The step after a reply's lines that records its story checks' results (practice.js `checkStep`). */
export const CHECK_STEP = 'rpg.check';
