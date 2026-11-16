// (data-modules/, not lean-rpg/: act.js reads it at page start, before the RPG loads.)
// Recovery and XP rules of a marked Character (the one with `scale: 2` on its bars): what the narrator's lines may and may not do, and the notes
// the reader sees when one is not used. Pure: no state is written here. A pin without the mark never reaches these checks, so old chats are untouched.
//
//   * `add-xp` from the story: not used (XP comes from won fights, by code; the reader's own edit stays).
//   * `set-health`, `set-stamina`, `set-mana` may lower a bar, never raise it (a rest, a full rest or a heal does that).
//   * `full-rest` from the story: not twice within 6 story hours for one character (no story clock: allowed).
//   * The recovery line (restLine): one line after a marked Character's own lines, outside the prompt and grammar caps; each clause only when the pin offers that
//     kind as a story kind and its effects are the standard ones. The pin is never touched.
// Public face: re-exports its parts.
export { FULL_REST_HOURS, RESTED_FIELD, RESTED_KNOWN, SET_KINDS } from './recovery-parts/constants.js';
export { isMarkedCharacter, hasRestButtons } from './recovery-parts/marked.js';
export { restLine } from './recovery-parts/rest-line.js';
export { recoveryNote, fullRestTooSoon } from './recovery-parts/notes.js';
