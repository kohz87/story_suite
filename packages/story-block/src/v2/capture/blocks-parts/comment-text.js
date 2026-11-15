// Story Suite v2: writing a comment body so no `--` ends it, reading it back, and the section tag names.

// --- The hidden comment's body -----------------------------------------------------------------------
// `<!-- STORY_SUITE_V2[ open][ off:word,word]` then the blocks' bodies, each in <Changes>…</Changes>, then
// (when there are any) the change lines a capture left in the story, in <Changes-story>…</Changes-story>,
// so a Re-read leaves them too (strayLines), and an open block's unfinished last line in <Changes-cut>…
// </Changes-cut>, for a Continue that finishes it (continuation()), and the story lines that echoed a
// line of the blocks (C-1), taken out of the story but never read, in <Changes-echo>…</Changes-echo>.
// The lines a read took from the story are one body of their own, marked `<Changes story>…</Changes>`:
// read like any other, and known as the story's to a Continue, whose block lines that repeat one of them
// are its echo (FB-1, earlierLines): kept in that Continue's <Changes-echo>, never read.
// `open`: the reply was cut off inside its last block. `off:`: display kinds (written words) whose lines were read while their feature was
// off, so they are not shown when it is turned on later, until a Re-read reads them again (markOff).
//
// An HTML comment ends at `-->` (or `--!>`), so no `--` may stand in its body. Each `--` is written with a
// word joiner (U+2060) between, and a word joiner already there is written twice, so the body read back
// (commentText) is exactly what was read live (B-a1-11). Comments written before this broke `--` up with a
// space ("- -"); they hold no word joiner between dashes and read as they always did.
const JOIN = '\u2060';
export const commentSafe = text => String(text).replace(/\u2060/g, JOIN + JOIN).replace(/-(?=-)/g, `-${JOIN}`);
export const commentText = text => String(text).replace(/\u2060\u2060|(?<=-)\u2060(?=-)/g, found => (found.length === 2 ? JOIN : ''));

export const sectionTags = tag => ({ story: `${tag}-story`, cut: `${tag}-cut`, echo: `${tag}-echo`, assist: `${tag}-assist`, next: `${tag}-assist-next` });
