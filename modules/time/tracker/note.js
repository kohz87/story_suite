// Story Director v2, tracker part: what the model is told (pure).
//
// static: the Director's change-line rules, the same bytes every reply of every chat (SPEC §5):
// v1's field rules and Pacing, word for word, under v2's `<Changes>` envelope (the host writes
// the block's header and each kind's one-line grammar).
// tail: v1's Director note (note.js) for this reply: the story time and place, what is due and
// arriving, the relevant threads one line per kind, what not to reveal, corrections for the
// last reply's lines, and the quest checks (a quest that reads finished, one the reader's message
// gives up, takes on or turns down). Built by v1's noteParts within this part's budget.
// What can happen now comes first (scene.js): the kind lines list only the threads that fit the
// scene, then one Initiative line (initiative.js, feature `story-director.initiative`), then, while
// the budget has room, at most `tracker.elsewhere` (2) other threads {{user}} knows of, by name only.
//
// Public face: re-exports its parts.

export { IDLE_REPLIES, TAIL_BUDGET, TAIL_THREADS } from './note-parts/budgets.js';
export { PACING_TEXT, STATIC_TEXT, staticText } from './note-parts/static.js';
export { GRAMMAR, GRAMMAR_ALONE, grammarOf } from './note-parts/grammar.js';
export { withoutEncounters } from './note-parts/encounters.js';
export { tailThreads } from './note-parts/tail-threads.js';
export { directorTail } from './note-parts/tail.js';
