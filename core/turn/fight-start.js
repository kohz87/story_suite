// A fight-start choice belongs to the reader's message and the reply it follows.
// Chat metadata keeps the choice and the typed attack's hold across reloads; it never changes the sheet. Public face: re-exports its parts.

export { pendingStart, holdStart, clearStart } from './fight-start-parts/hold.js';
export { fightsInMessage } from './fight-start-parts/message-gate.js';
export { FIGHT_CUE, FIGHT_WORDS_MIN, fightCue } from './fight-start-parts/cue.js';
