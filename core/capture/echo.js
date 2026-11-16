// Story Suite v2: the assist sections and the echoed change lines (moved out of capture.js unchanged; capture.js re-exports the public
// names): `<Changes-assist>` sections and `withAssist`, a line a reply repeats from an earlier block, and `readParts`, which joins the
// block, the whole lines and the echoes. Imports capture/lines.js and capture/blocks.js.
// Public face: re-exports its parts.

export { assistSections, withAssist } from './echo-parts/assist.js';
export { sameLine, sameChangeLine } from './echo-parts/same-line.js';
export { readParts, STORY_WORD } from './echo-parts/read-parts.js';
