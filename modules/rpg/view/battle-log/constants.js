// The battle log's shared words and marker: the strings every part reads, the panel's root and screen ids, the
// narrator's `[battle]` line, and the fold and recent-message constants used by the live controller.
// Public face: re-exports its parts.

export { B, FOE_WORDS, DECISIVE_WORDS, IDLE } from './constants-parts/words.js';
export { BATTLE_ROOT, BATTLE_ID, MARKER_LINE } from './constants-parts/ids.js';
export { FOLD_KEY, RECENT_MESSAGES } from './constants-parts/live.js';
