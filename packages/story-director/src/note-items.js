// Story Director: the note's record, due, arrival and While away lines (pure).
//
// Item rendering moved out of note.js; note.js re-exports only its own former public names.
// Public face: re-exports its parts.

export { encounterOf, noteFields, destination } from './note-items-parts/shared-fields.js';
export { withFight, withReach, fightPart, withAwayFight } from './note-items-parts/encounters.js';
export { addBeats, addLine } from './note-items-parts/lines.js';
export { dueItem, awayPart, payItem, awayDueItem } from './note-items-parts/due.js';
export { arrivalItem, questItem, recordItem } from './note-items-parts/records.js';
