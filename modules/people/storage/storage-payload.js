/* NPC State Delta sidecar payload format: format markers, base64 encoding, retained portrait-asset
   pruning, compact state preparation and JSON encode/decode. Moved unchanged out of storage.js;
   storage.js re-exports every public name it exported before. Never imports storage.js.
   Public face: re-exports its parts. */
export { NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_FORMAT_VERSION, LEGACY_FORMAT_VERSION, NPC_STATE_FILE_READ_VERSIONS } from './storage-payload-parts/format.js';
export { bytesToBase64 } from './storage-payload-parts/base64.js';
export { retainedPortraitAssetIds, prunePortraitAssetsForState, pruneFormPortraitAssetsForState, prunePortraitAssetsInPlace } from './storage-payload-parts/portrait-retention.js';
export { encodeStateFilePayload, encodeRetiredStateFilePayload } from './storage-payload-parts/encode.js';
export { decodeStateFilePayload, decodeStateFileHead } from './storage-payload-parts/decode.js';
