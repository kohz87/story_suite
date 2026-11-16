// Story Block v2: the small notes under a reply, and the reply's refused change lines (MODULES §F40, §F41).
// ui-host.js creates one per page.
//
// * **No change lines** (§F40): a reply Story Block read (it has a v2 record for the shown swipe) whose text
//   holds no <Changes> block, while the after-reply extractor is off, gets a quiet one-line warning under
//   its text. Nothing is wrong when nothing changed; the warning says that nothing was kept, so a reply that
//   told of a rope picked up without listing it is noticed.
// * **Edited**: a reply edited in this session keeps the changes it had (SPEC §4.2); its note says so.
// * **Re-read** on either note runs the host's Re-read for that reply (`reread(index)`, which replaces the
//   reply's `story` receipts with a fresh capture of its <Changes> block, store.replaceStory). Only when
//   the host offers one: without it the missing-lines note shows alone and edits get no note.
// * **Refused lines** (§F41): what the turn reported for a reply (its `turn` event's problems, or the
//   turn's problems list for that index) as `[{ line, reason }]`, per reply and swipe, for the changes card.
//
// The greeting, the reader's messages, system messages and replies from before v2 never get a note. Every
// text is set with textContent; the texts are in strings.js.
// Public face: re-exports its parts.

export { problemReason, warnedFrom, refusedFrom } from './reply-notes-parts/problems.js';
export { RECENT_MESSAGES, createReplyNotes } from './reply-notes-parts/notes.js';
