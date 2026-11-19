/* NPC State persistence facade: the sidecar identity, payload codec, file transport and inspection live in focused parts, and so do
   writer locking, the durability queue, sidecar writes and the recovery/retire/read operations. Every public name stays exported here. */
// Public face: re-exports its parts.

export { dataFileExists, dataFilesExist, deleteNpcStateDataFile, readPortraitFileDataUrl, savePortraitFile, verifyPortraitFiles } from './storage-files.js';
export { currentWriterId, makeNpcStateDataFileName, makeNpcStateRecoveryFileName } from './storage-names.js';
export { NPC_STATE_WRITE_RETRY_DELAYS_MS, NPC_STATE_DURABILITY_RETRY_CAP_MS } from './storage-retry.js';
export { undurableNpcStateSnapshot, preserveUndurableNpcStateSnapshot } from './storage-undurable.js';
export { encodeStateFilePayload, encodeRetiredStateFilePayload } from './storage-encode.js';
export { cancelPendingNpcStateWrite, pendingNpcStateDurabilityKeys, writeNpcStateDataFile } from './storage-write.js';
export { quarantineUnreadableNpcStateDataFile, retireNpcStateDataFile } from './storage-retire.js';
export { readNpcStateDataFile } from './storage-read.js';
export { NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_FORMAT_VERSION, bytesToBase64, decodeStateFileHead, decodeStateFilePayload, pruneFormPortraitAssetsForState, prunePortraitAssetsForState, prunePortraitAssetsInPlace, retainedPortraitAssetIds } from './storage-payload.js';
export { adoptNpcStateDataFileMetadata, inspectNpcStateDataFile, probeNpcStateDataFilePointer } from './storage-inspect.js';
