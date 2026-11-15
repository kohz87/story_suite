/* NPC State Delta dossier surface: the library screen (faces ringed by tone, search, key people first).
   Replaces the cast rail's renderRail: pure list shaping and markup; the panel owns the DOM and the refs. Public face: re-exports its parts. */
export { FACE_RING_VARS, faceRingVar } from './dossier-ui-library-parts/face-ring.js';
export { keyFirstRows, libraryRows, librarySignature } from './dossier-ui-library-parts/rows.js';
export { libraryFootHtml, libraryCountHtml, librarySearchHtml } from './dossier-ui-library-parts/foot.js';
export { libraryFaceHtml, libraryHtml } from './dossier-ui-library-parts/faces.js';
