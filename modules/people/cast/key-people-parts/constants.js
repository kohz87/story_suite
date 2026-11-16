// The key-people constants: recent-reply window, fields held still while away, the return-note length.

/** Replies a returned key person must be present for before the dossier drops "While away". */
export const RECENT_REPLIES = 3;
/** The stable profile fields and the custom fields a scan leaves alone while a key person is away (as if locked). */
export const AWAY_LOCKED_FIELDS = Object.freeze(['personality', 'speech', 'appearance', 'mannerisms', 'behaviorProfile', 'background', 'customFields']);
/** The longest "While away" summary the narrator is given with the returned person's dossier. */
export const RETURN_NOTE_CHARS = 360;
