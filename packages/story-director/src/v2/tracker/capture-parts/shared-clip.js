// Story Director v2, tracker part: the cut of a quoted line the capture parts share.

// The longest a line is quoted in a summary or a Problem.
const QUOTE_CHARS = 300;

export const clip = value => (value.length > QUOTE_CHARS ? `${value.slice(0, QUOTE_CHARS - 1)}…` : value);
