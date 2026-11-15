// NPC State Delta, the participant's native checkpoint (contract §8: "persists full native state/history/evidence/identity map and applied
// death IDs"). A checkpoint is one document, immutable once made, named by its own hash:
//
//   { schema, kind, lineage, cursor, headHash,
//     state }     the chat's whole native state as Delta keeps it: dossiers (with their evidence and locks), candidates, the social graph
//                 (the relationship map), the rollback checkpoints and lineage (its history), portraits, pending work, and `timeline`: the
//                 np_ map, the reserved ids and the applied deaths (timeline.js)
//
// Restoring one installs the state, and with it the np_ map and the deaths, **together**, so a dossier and its np_ can never come from different
// times. A checkpoint belongs to a lineage (the story's native line, stored in the state), not to a chat's key or file name: renamed, branched
// or exported, the chat still finds its checkpoints. The document is plain JSON, its hash is the contract's Hash of it, and its id is derived from
// the hash, so the same native state at the same head is the same checkpoint.
// Public face: re-exports its parts.

export { PARTICIPANT_SCHEMA, KIND, CHECKPOINT_ID, KIND_PACKED } from './checkpoint-parts/shared-basics.js';
export { checkpointIdOf } from './checkpoint-parts/checkpoint-id.js';
export { cleanApplied } from './checkpoint-parts/applied-deaths.js';
export { buildCheckpoint, checkpointProblem } from './checkpoint-parts/checkpoint-document.js';
export { packForFile, unpackFromFile } from './checkpoint-parts/file-packing.js';
