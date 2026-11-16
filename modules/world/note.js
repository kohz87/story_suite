// Story Director: the injected note (pure).
//
// Turns a relevance Selection into the short system note injected before each reply: a
// header with the story time and place, what is due and arriving, the relevant records one
// line per kind, what not to reveal, corrections, and the instruction for writing change
// lines. The note keeps within a token budget by dropping the least relevant records, and
// writes no part longer than NOTE_PART_WORDS (the tracker keeps the whole text).
//
// This path stays the public facade: fixed text, formatting, item lines and header/distance
// helpers moved to small note-*.js files.
// Public face: re-exports its parts.

export { CHANGE_INSTRUCTION, PACING, PACING_NO_CHANGES, ENCOUNTER_CUE, NPC_PLANS_ONLY, AWAY_CUE, AWAY_RECORD, AWAY_ARRIVAL, AWAY_DEADLINE } from './note-text.js';
export { NOTE_PART_WORDS, notePart } from './note-format.js';
export { DISTANCES_OFF, NO_WEEKDAYS, noteHeader } from './note-extra.js';
export { DIRECTOR_OUTPUT_TOKENS, noteTokens } from './note-parts/tokens.js';
export { STATIC_LABELS, staticNote, withFixedNote } from './note-parts/static.js';
export { buildNote, tailNote, noteParts } from './note-parts/parts.js';
