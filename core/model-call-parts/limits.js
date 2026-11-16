// The default time limit of a model call, its bounds, and the default token count.

/** The default time limit of one call (ms), and the bounds a caller's `timeoutMs` is kept inside. */
export const MODEL_CALL_TIMEOUT_MS = 60_000;

export const MODEL_CALL_TIMEOUT_MIN = 1_000;

export const MODEL_CALL_TIMEOUT_MAX = 600_000;

/** maxTokens when a caller gives none, and the most it may ask. */
export const MODEL_CALL_TOKENS = 300;
