// Keeps a failed board capture attached to the reply's stable record ID.
// Markers are add-only; the reply's recorded prelude shows when capture succeeded.
// The turn restores the small capture session after a reload or swipe.
// Public face: re-exports its parts.

export { boardStep } from './held-board-parts/shared-board.js';
export { restoreHint, boardFailure } from './held-board-parts/failure.js';
export { heldForSid, heldForMessage, rememberHeld, discardHeld } from './held-board-parts/held.js';
export { pruneMissingBoard, boardStartState } from './held-board-parts/board-state.js';
