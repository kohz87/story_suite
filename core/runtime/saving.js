// The runtime's saving helpers (moved out of runtime.js unchanged): createStore's save options, the
// save stamps and read-back copies, rescue lookup, the tainted mark and the page-unload save.
// Public face: re-exports its parts.

export { storeSaving, SAVE_SEQ_KEY, MEMO_PREFIX } from './saving-parts/store-saving.js';
export { markUsed, pageStorage } from './saving-parts/page-marks.js';
export { saveOnUnload } from './saving-parts/unload.js';
