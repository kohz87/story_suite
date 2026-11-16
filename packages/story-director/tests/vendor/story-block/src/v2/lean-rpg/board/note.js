// Makes the narrator's settled account from the board's recorded lines.
// Every outcome and every bar movement is included, even in a long fight; one line is told as one
// [Happened] cue and is never cut. Opening names come from the recorded setup for both preview and receipt.

// Public face: re-exports its parts.

export { barMovement } from './note-parts/bar-movement.js';
export { LONG_FIGHT, OUTNUMBERED, intenseFight, fightLength } from './note-parts/fight-length.js';
export { settledNote } from './note-parts/settled-note.js';
export { labelLine, labelAreaGroup } from './note-parts/log-labels.js';
