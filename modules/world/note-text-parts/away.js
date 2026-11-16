// Story Director: fixed While-away recap cues for the note.

// (0.9.19) After the While away list, about 20 tokens: what came due in a skipped stretch of
// time already happened, so the story tells its outcome rather than staging it now.
export const AWAY_CUE = 'Show what came of them as news, signs or aftermath, not as scenes {{user}} lived through.';
// Added only where the model writes change lines: about 10 tokens, 10 more with an arrival and
// 20 more with a passed deadline.
export const AWAY_RECORD = 'Record each with ! Key — what came of it.';
export const AWAY_ARRIVAL = 'An arrival: ~ Key — now: where it is.';
export const AWAY_DEADLINE = 'A passed deadline: - Key — failed, or ~ Key — due: later if it still stands.';
