// The remaining feature ids: the anti-lever gate, mood and pull, and dossier notes.

// The anti-lever gate (npc-meters-gate.js): on by default (the owner restarts the chat, as for World pulse). A reply already written keeps its
// stored ops on every replay, rebuild, swipe and delete; only a Re-read of an old reply runs its lines again, and an old line has no `via`.
export const FEATURE_GATE = 'npc-state-delta.anti-lever';
export const FEATURE_MOOD_PULL = 'npc-state-delta.mood-pull';
// Dossier notes (src/npc-notes-kinds.js): lies told, what a person knows of others, tastes, ties; story kinds `~ lie|know|taste|tie`.
export const FEATURE_NOTES = 'npc-state-delta.notes';
