/* NPC State Delta sidecar file transport: upload of JSON payloads, existence probes and cast-portrait
   user-file save/verify/read helpers. Moved unchanged out of storage.js; storage.js re-exports every
   public name it exported before. Never imports storage.js. Public face: re-exports its parts. */
export { uploadPayload, deleteNpcStateDataFile } from './storage-files-parts/upload.js';
export { dataFileExists, dataFilesExist } from '../portrait/exists.js';
export { savePortraitFile, verifyPortraitFiles, readPortraitFileDataUrl } from '../portrait/portraits.js';
