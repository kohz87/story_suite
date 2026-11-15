// Story Director v2, chronicle part: the text shared by the chronicle's change lines and reader commands
// (moved out of capture.js unchanged; capture.js re-exports the public names): the line text, the Director's
// clock, state words, names and labels, and the sentence helper. It imports only the chronicle domain.
// Public face: re-exports its parts.

export { CLEAR, asText, readState, readNames } from './text-parts/parse.js';
export { lineText, labelOf, sentence } from './text-parts/format.js';
export { clockOf } from './text-parts/clock.js';
