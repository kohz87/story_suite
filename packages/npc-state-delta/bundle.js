/* NPC State Delta native bundle merge: cross-chat dossier and graph import. Codec exports are re-exported. Public face: re-exports its parts. */
export { binaryToDataUrl, dataUrlToBinary, decodeNpcStateBundle, encodeNpcStateBundle } from './bundle-codec.js';
export { mergeImportedDossierState } from './bundle-parts/merge.js';
