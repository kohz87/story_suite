/* NPC State Delta checkpoint packing for sidecar format version 2: pure functions that turn the in-memory
   checkpoint array (one full snapshot per entry) into its on-disk form and back. Entries are full (the newest
   replies, every anchor turn, chain heads, stalled chains, and any entry whose patch does not verify or does not
   save bytes) or packed: an RFC 6902 patch, restricted to add/replace/remove, against an earlier entry's rebuilt
   image. Entries without a plain `snapshot` object are stored verbatim and never serve as a base. No I/O, no
   clock, no randomness, no module-level state; imports nothing. storage-payload.js is the only caller. The
   in-memory checkpoints keep their shape: packing happens at the file boundary only. Public face: re-exports its parts. */

export { PACK_SCHEME, PACK_DEFAULTS, PackError } from './checkpoint-pack-parts/pack-constants.js';
export { applyJson } from './checkpoint-pack-parts/pack-apply.js';
export { diffJson } from './checkpoint-pack-parts/pack-diff.js';
export { packCheckpoints } from './checkpoint-pack-parts/pack-encode.js';
export { unpackCheckpoints } from './checkpoint-pack-parts/pack-decode.js';
