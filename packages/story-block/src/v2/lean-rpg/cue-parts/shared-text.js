// Text cutting shared by the cue's line, name and text parts.

// Names are cut at this many characters only as the last way to fit the cue (shape 3 below).
export const NAME_CUT = 20;

export const cut = (text, max) => (max && text.length > max ? `${text.slice(0, max - 1)}…` : text);
