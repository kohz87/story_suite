// Story Suite v2: finding the hidden block in a reply (moved out of capture.js unchanged; capture.js re-exports the public names): the
// HTML comment a captured block is kept in, the paired-tag and comment scanners, blank-line trimming, `findBlocks` and `readBlocks`,
// the reasoning spans left out of a scan, an open block cut off by Continue, and the section tags. Imports only capture/lines.js.
// Public face: re-exports its parts.

export { closedPairs, replacePairs, blank } from './blocks-parts/pairs.js';
export { HIDDEN_MARKER, HIDDEN_CLOSE, hiddenPairs } from './blocks-parts/marker.js';
export { commentSafe, commentText, sectionTags } from './blocks-parts/comment-text.js';
export { commentParts, commentBlocks } from './blocks-parts/comment-parts.js';
export { hasHidden, markOff, markCaps, capsOf } from './blocks-parts/comment-header.js';
export { blockBody, findBlocks, wholeLines } from './blocks-parts/find.js';
export { reasoningPairs, withoutReasoning, maskReasoning, defangMarker } from './blocks-parts/reasoning.js';
export { bareBlocks } from './blocks-parts/bare.js';
export { cutLine, readBlocks } from './blocks-parts/read.js';
export { CUT_MARK, continuation } from './blocks-parts/continue.js';
