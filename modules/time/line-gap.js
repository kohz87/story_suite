// How many replies have passed since the story last moved the clock, and the tail's reminder at three.

/** Replies without a time line at which the tail reminds the story. */
export const GAP_REPLIES = 3;

/**
 * Whole replies written since the chat message at `lastIndex` (null: none ever; counted from the chat's first message) when the
 * next reply is about to be written: the chat holds `length` messages, the last one the reader's. Never negative.
 */
export function replyGap(length, lastIndex) {
    if (!Number.isSafeInteger(length)) return 0;
    const from = Number.isSafeInteger(lastIndex) ? lastIndex : 0;
    return Math.max(0, Math.floor((length - from - 2) / 2));
}

/** The reminder line for a gap of `gap` replies, or '' while it is shorter than GAP_REPLIES. */
export function gapCue(gap) {
    if (!Number.isSafeInteger(gap) || gap < GAP_REPLIES) return '';
    return `Story time: no time line for ${gap} replies; if time has passed, write ~ time <clock> or ! time +<how long>.`;
}
