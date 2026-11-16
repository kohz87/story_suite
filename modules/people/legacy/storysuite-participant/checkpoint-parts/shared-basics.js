// Constants shared by the checkpoint parts: the schema number, the two document kinds and the checkpoint id pattern.

export const PARTICIPANT_SCHEMA = 1;
export const KIND = 'npc-state-delta-native';
export const CHECKPOINT_ID = /^nk_[0-9a-z]{8}$/;
export const KIND_PACKED = 'npc-state-delta-native-packed';
