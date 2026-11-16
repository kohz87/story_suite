// The checkpoint thresholds and the replan code an owner answers with.
export const CHECKPOINT_EVERY = 100;
export const CHECKPOINT_BYTES = 128 * 1024;
// The bytes rule never puts checkpoints closer than this many carriers, and waits for at least twice
// the last checkpoint's own size of ops: one domain that rewrites a large list whole on every reply
// cannot make every few replies write the whole state again (b6-soak).
export const CHECKPOINT_MIN_GAP = 10;
/** The code an owner's replan answers with when the step is no longer done (REPLAY.md): only this removes a block. */
export const NO_LONGER_DONE = 'NO_LONGER_DONE';
