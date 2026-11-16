// Story Director v2, part **keypeople**: storage and retention limits for domain tables.

/** The largest cap the setting takes; and the most pins, away records or notes any state may hold. */
export const MAX_CAP = 100;
export const MAX_STORED = 200;

/** Taken-off entries kept (the newest). */
export const MAX_GONE = 30;
/** Replies whose notes are kept for their cards (the newest). */
export const MAX_NOTE_REPLIES = 6;
