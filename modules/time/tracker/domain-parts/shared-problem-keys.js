// Story Director v2, tracker part (domain): the problem list's size limits, key rule and order, shared by its writers and its validator.

import { REPLY_KEY, entryOrder } from '../../../world/reply-keys.js';

export const PROBLEM_LIMIT = 50;

/** How many problems are kept; the newest PROBLEM_LIMIT are shown. */
export const PROBLEM_ROOM = 2 * PROBLEM_LIMIT;

/** A problem's key: `<sid>.<n>` (the reply's record ID), or `<rev>.<n>` in an older state (reply-keys.js). */
export const PROBLEM_KEY = REPLY_KEY;

/**
 * The problems' order, for `[key, problem]` pairs: by the reply they came from (`turn`, the reply count when written), then `rev`,
 * then the key's count. Not `rev` first: after an edited reply is Re-read with more lines, its new revisions run past those a
 * later reply's stored problems hold, but its reply count stays below theirs.
 */
export const problemOrder = entryOrder(problem => [problem?.turn, problem?.rev]);
