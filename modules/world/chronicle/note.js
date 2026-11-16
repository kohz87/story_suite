// Story Director v2, chronicle part: what the model is told (pure).
//
// static: two fixed lines, the same bytes every reply of every chat (SPEC §5): what is worth a
// world or faction line, and what the [World] lines in the tail are for. The kinds' one-line
// grammar (GRAMMAR) is written by Story Block under its `<Changes>` header.
// tail: `[World] Under way off-screen:` and at most three open events picked by code (pick.js),
// each with its place, its summary and how long since the last news of it, so the story can move
// the world on. Within about 120 tokens; nothing when no event is open.
// Public face: re-exports its parts.

export { GRAMMAR, STATIC_TEXT, TAIL_BUDGET } from './note-parts/static-prompt.js';
export { TAIL_HEADER, chronicleTail } from './note-parts/tail.js';
