// NPC notes, the kinds (NSDMAP2 §9 item 7): the one file that imports the six npc-notes-* files. KINDS maps each `~` line kind
// (lie, know, taste, tie) to its record field and handler. A handler takes the stored leaf, one parsed line and a context
// { name, day, r, userText, tier, drop, notes } and returns { text, problem }: `text` is the new leaf (null clears a tie leaf),
// `problem` is '' or the reason the whole command is refused. A handler reports code-set effects through the notes option:
// notes.run(change) for a meter change (a caught lie's trust drop, to run() at a tier) and notes.flag(text, cue) for a Problem
// or receipt. The handlers do not store anything; the host writes the leaves inside the reply's own op. NOTE_FIELDS lists the
// record fields these kinds own; validateNotes(record) checks them; notesTail(record, ctx) builds the optional tail lines.
// Pure: no storage, never imports npc-meters.js.
// Public face: re-exports its parts.
export { lookStamp, readLookStamp, CAUGHT_TIER, CAUGHT_DROP } from './npc-notes-kinds-parts/passthrough.js';
export { NOTE_FIELDS, NOTES_TAIL_PER_NPC, NOTES_TAIL_MAX } from './npc-notes-kinds-parts/consts.js';
export { KINDS, runKind } from './npc-notes-kinds-parts/handlers.js';
export { validateNotes } from './npc-notes-kinds-parts/validate.js';
export { notesTail } from './npc-notes-kinds-parts/tail.js';
export { noteRule, markNote } from './npc-notes-kinds-parts/rule-marks.js';
export { noteKinds, isNoteKind, noteField } from './npc-notes-kinds-parts/grammar.js';
export { noteLine } from './npc-notes-kinds-parts/line.js';
export { dossierNotes } from './npc-notes-kinds-parts/dossier.js';
export { seedNotes } from './npc-notes-kinds-parts/seed.js';
export { driveScale } from './npc-notes-kinds-parts/drive-scale.js';
export { tieRows, owedBy, foldTies, aliasCanon } from './npc-notes-kinds-parts/ties.js';
