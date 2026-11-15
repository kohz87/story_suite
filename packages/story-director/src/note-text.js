// Story Director: the note's fixed text (pure).
//
// Change instruction, Pacing, encounter, NPC-plans and While away cues. Moved out of note.js;
// note.js re-exports every public name.
// Public face: re-exports its parts.

export { CHANGE_INSTRUCTION, NPC_PLANS_ONLY } from './note-text-parts/instruction.js';
export { PACING, PACING_NO_CHANGES, ENCOUNTER_CUE } from './note-text-parts/pacing.js';
export { AWAY_CUE, AWAY_RECORD, AWAY_ARRIVAL, AWAY_DEADLINE } from './note-text-parts/away.js';
