// Story Director v2, chronicle part: defines line, character, and day count budgets for the earlier-days backlog block.

export const BACKLOG_TAG = '[Earlier days]';
/** At most this many day lines. */
export const BACKLOG_LINES = 6;
/** About 200 tokens: Story Block counts a token as four characters. */
export const BACKLOG_CHARS = 800;
/** The last past days are always in (when they have anything to tell). */
export const ALWAYS_DAYS = 2;
