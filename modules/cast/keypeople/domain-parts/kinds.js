// Story Director v2, part **keypeople**: alias limit and allowed removal-reason and note-kind enums.

export const MAX_ALIASES = 6;

/** Why someone left the list: the story recorded a death, NPC State Delta archived them, or the reader unpinned them. */
export const REASONS = Object.freeze(['died', 'archived', 'unpinned']);
export const NOTE_KINDS = Object.freeze(['back', 'gone']);
