// Plays a sequence of board exchanges on a private copy of the sheet.
// The UI and the reply's resolver call this same function with the fixed setup and choices.
// It reads the existing Standard rules and writes only the returned copy and result.
// Public face: re-exports its parts.

export { boardWitness } from './engine-parts/witness.js';
export { equipmentForBoard } from './engine-parts/equipment.js';
export { applyHurts, clearFoes } from './engine-parts/hurts.js';
export { playBoard } from './engine-parts/play.js';
