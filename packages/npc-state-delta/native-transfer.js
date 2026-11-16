/* NPC State Delta native transfer envelope. Keeps the established binary codec and adds declared Stage 8 metadata. */
// Public face: re-exports its parts.

export { buildHistoryArchive } from './native-transfer-parts/history-archive.js';
export { augmentNativeBundle } from './native-transfer-parts/augment.js';
export { decodeDeltaNativeBundle } from './native-transfer-parts/decode.js';
export { nativeStateForTarget, prepareNativeImport } from './native-transfer-parts/import.js';
