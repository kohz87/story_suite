// A cast portrait is kept once, as its own SillyTavern user file, named by its content: /user/files/npc-state-delta-portrait-<hash>.<ext>.
// The dossier keeps only the record { path, type, hash, width?, height?, sourceName?, updatedAt?, appearanceFingerprint? } and the chat's
// state file never holds the image, so a met person costs a few hundred bytes of state instead of the whole picture (twice).
// A file is only ever written when it is absent and never deleted (it outlives the pack and every checkpoint that names it).
//
// This file is pure (no DOM, no host): the record's shape, what shows, and the session's memory of which files the server
// said are gone. storage.js does the requests (savePortraitFile, verifyPortraitFiles, readPortraitFileDataUrl). Records that
// carry `dataUrl` (an upload, a generated portrait, a chat made before this) are read exactly as before; nothing here rewrites them.
// Public face: re-exports its parts.
export { PORTRAIT_FILE_PREFIX, PORTRAIT_FILE_DIR, portraitFileName } from './portrait-file-parts/shared-name.js';
export { sha256Hex } from './portrait-file-parts/hash.js';
export { isPortraitFileRecord, portraitHasImage, portraitFileRecordFor } from './portrait-file-parts/record.js';
export { markPortraitFileMissing, markPortraitFilePresent, portraitFilesVersion } from './portrait-file-parts/missing.js';
export { portraitFileSrc, portraitFileKnownGone, portraitSrc } from './portrait-file-parts/view.js';
export { PORTRAIT_FILE_MAX_BYTES, parseImageDataUrl, dataUrlOfBytes } from './portrait-file-parts/data-url.js';
