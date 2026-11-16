// Story Director v2, tracker part: the length and count limits a story-told thread line keeps.

/** The longest thread name kept, in characters: a longer one is cut (at a space when there is one). */
export const KEY_CHARS = 120;
/** The longest thread summary kept, in characters: a longer one is cut (at a space when there is one). */
export const SUMMARY_CHARS = 600;
/** New threads one reply's lines may add; a line that would add more is not used (a Problem says so). */
export const NEW_THREADS_PER_REPLY = 16;
/** Open threads the Director follows at once; a line that would add one more is not used (B-b1r2-8). */
export const MAX_OPEN_THREADS = 300;
