// Story Suite v2: the store's constants and small pure helpers (moved out of store.js unchanged; store.js re-exports
// the public ones). Checkpoint thresholds, the replan code an owner answers with, the host's savepoint-block test,
// the reader-setup test, and deepFreeze (every state the store hands out is deep-frozen).
// Public face: re-exports its parts.
export { CHECKPOINT_EVERY, CHECKPOINT_BYTES, CHECKPOINT_MIN_GAP, NO_LONGER_DONE } from './constants-parts/checkpoints.js';
export { touchesHostDomain, hostBlock, readerSetup } from './constants-parts/host-blocks.js';
export { isObject, jsonBytes, deepFreeze, revOf } from './constants-parts/values.js';
