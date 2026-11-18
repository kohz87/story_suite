// The sidecar file format marker and the format versions it is written and read in.
export const NPC_STATE_FILE_FORMAT = 'npc_state_delta_chat_data';
// Format 1 is written: the state as plain JSON. Format 2 packed the branch journal's checkpoints; the journal is gone (B4-10a), so a format 2
// file is still read and its checkpoints are dropped. An older build refuses a version it does not know.
export const NPC_STATE_FILE_FORMAT_VERSION = 1;
export const NPC_STATE_FILE_READ_VERSIONS = Object.freeze([1, 2]);
