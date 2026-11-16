// Names: the prelude and step names for the item, no-roll, dice and check records.

/** The consumables' own effect (owner 14 Nov): a bag item's pool restored. The inventory's Use on… and the story's used line call it when no other module answers `item.use`. */
export const USE_ITEM = 'rpg.useItem';
/** The prelude that records, with the reply, that a live fight's roll planner (gone; old records only) gave nothing usable (noroll.js): the note under the reply is drawn from it. */
export const NOROLL = 'rpg.noroll';

/** The prelude that rolls a reply's three story-check dice and records them with it (checks/dice.js; the narrator's note is drawn from it, cue.js). */
export const DICE = 'rpg.dice';
/** The fight kind's two internal writes to the Foes block (board/changes.js): the foes' new bars, and an ended fight's groups leaving the block. */
export const BOARD_HURTS = 'rpg.board.hurts';
export const BOARD_CLEAR_FOES = 'rpg.board.clearFoes';
/** The step after a reply's lines that records its story checks' results (practice.js `checkStep`). */
export const CHECK_STEP = 'rpg.check';
