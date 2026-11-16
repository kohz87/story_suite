// The battle log's panel root and screen ids and the narrator's `[battle]` marker line.

export const BATTLE_ROOT = 'rpg-battle';
export const BATTLE_ID = 'rpg/battle-log';
/** The narrator's marker: a line of its own. (turn.js strips the same line from the prompt history.) */
export const MARKER_LINE = /^[ \t]*\[battle\][ \t]*$/i;
