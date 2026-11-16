// Story Director v2, tracker part (note): the tail's size limits: token budget, thread count, idle replies.

export const TAIL_BUDGET = 500;
/**
 * The most relevant threads the tail lists, at most (B-b1-capture-13). v1's note drops threads from the
 * end until it fits its budget, building the note again each time, so with hundreds of threads every
 * reply paid for all of them; 40 short ones already fill the budget.
 */
export const TAIL_THREADS = 40;
/**
 * How long an open thread may go untouched (replies with Director lines since it was last seen or
 * changed) before the tail stops reading it (B-b1r2-8), unless it has a date, is a quest the reader
 * took on, is pinned, is a secret, or the reader's message or the scene's place names it. v1 already
 * shelves such a thread after 15 quiet replies; this only keeps the work per reply with the live ones.
 */
export const IDLE_REPLIES = 60;
