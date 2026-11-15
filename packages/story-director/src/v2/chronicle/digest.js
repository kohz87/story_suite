// Story Director v2, chronicle part: writing the day digests (feature `story-director.digest`), the
// hook that asks for it, and the one tail line after a time skip. Pure apart from the ctx.
//
// Before each reply (`beforeGenerate`), two system commands, both receipts on the head reply:
// * `chronicle.note`, when anything was committed since the last note (meta.rev moved on): reads those
//   receipts while they are fresh (`chronicle.noteFacts`; Story Block trims old receipts' data) and
//   keeps their facts by day under `chronicle.dayFacts["<day>.<rev>"]` (days.js). The entries go with
//   the reply they are a receipt of: a swipe or a delete of it takes exactly its facts away.
// * `chronicle.digest`, when the clock's day has moved past `chronicle.written` (or a day written then
//   is gone, because the reply that wrote it was deleted): writes a digest for each finished day since
//   the last write (and each one gone missing) from that day's entries, applies the caps and records
//   where it got to. A whole day's entries stay (up to FOLLOW_MAX): its digest follows them when one of
//   its replies is deleted later (days.daysOf); a short day's go. A chat from before the entries (no `noted`) has its
//   older days read from the receipts as before. Replay applies the receipts' ops; it never runs these.
// Public face: re-exports its parts.

export { digestOn } from './digest-parts/shared-ask.js';
export { daysToWrite, needsDigest } from './digest-parts/write-days.js';
export { NOTE, noteCommand, noteCommands } from './digest-parts/note.js';
export { digestCommand, digestCommands } from './digest-parts/digest-command.js';
export { YESTERDAY_TAG, LAST_DAY_TAG, DIGEST_TAIL_BUDGET, digestTailLine } from './digest-parts/tail.js';
export { BACKLOG_BUDGET, BACKLOG_STATIC, backlogLines } from './digest-parts/backlog-lines.js';
export { BACKLOG_PIN_CHARS, backlogCue, backlogOlder } from './digest-parts/backlog-cue.js';
