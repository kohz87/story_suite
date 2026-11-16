// Story Suite v2: the turn's save batching window (idle and its latest bound).

// The turn's save (`idle()`, docs/v2/PERFORMANCE.md "Long chats"): the reply's capture and the reader's actions
// after it go out in one write, IDLE_MS after the last of them, and never later than IDLE_MAX_MS after the
// first one not yet saved.
export const IDLE_MS = 1500;
export const IDLE_MAX_MS = 8000;
