// Memory facts (design MEMDESIGN2 §3): the event key. A synchronous SHA-256 (the browser's own is async, which would break the
// atomic merge transactions) over a canonical length-prefixed UTF-8 tuple, and the full 256 bits as unpadded base64url behind "v1:".
// Pure: no state, no DOM. Collision quarantine lives in memory-fact-store.js (it needs the stored tuple hash).
// Public face: re-exports its parts.
export { sha256Bytes } from './memory-fact-key-parts/sha256.js';
export { base64url, canonicalTuple, hashText } from './memory-fact-key-parts/encoding.js';
export { factKey, factIdentity } from './memory-fact-key-parts/fact-key.js';
