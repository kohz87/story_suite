// The sidecar file format marker and the format versions it is written and read in.
export const NPC_STATE_FILE_FORMAT = 'npc_state_delta_chat_data';
// Format 2 packs state.checkpoints on disk only (checkpoint-pack.js); the in-memory state is unchanged. Format 1 is still read, and is
// written when packing fails (the escape hatch) and by retired markers. An older build refuses a version it does not know.
export const NPC_STATE_FILE_FORMAT_VERSION = 2;
export const LEGACY_FORMAT_VERSION = 1;
export const NPC_STATE_FILE_READ_VERSIONS = Object.freeze([1, 2]);
