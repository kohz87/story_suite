// Story Suite v2: reading one change line (moved out of capture.js unchanged; capture.js re-exports the public names): the ops, the line
// length cap, the markdown and bullet decoration a model puts around a line, `parseLine` and `parseChanges`, and the kind words a
// module declares (`grammarHeads`). The lowest layer of capture: it imports nothing from the other capture files.
// Public face: re-exports its parts.

export { escapeRe, MAX_LINE, isSpace, trimEnd } from './lines-parts/shared-text.js';
export { stripMarkdown, stripDecoration, stripCaretWords, lineBody } from './lines-parts/decoration.js';
export { OPS, parseLine } from './lines-parts/parse-line.js';
export { NOTHING, parseChanges } from './lines-parts/parse-changes.js';
export { KIND_WORD, grammarHeads } from './lines-parts/kinds.js';
