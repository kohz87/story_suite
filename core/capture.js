// Change lines (docs/v2/SPEC.md §4.4): the hidden <Changes> block a reply ends with, one proposal
// per line, `op kind Name[ — text][ | label: value]*`. Parsing is lenient because models drift
// (bullets, bold, code fences, either dash, a colon after the kind); a line that is not a change
// becomes a problem, never an exception. Each line is handed to the module that owns its kind
// (turn.js), which decides what it means. Pure: no DOM, no SillyTavern.
// Public face: re-exports its parts.

export { extractBlock } from './capture-parts/extract.js';
export { stripBlock } from './capture-parts/strip.js';
export { hideBlock } from './capture-parts/hide.js';
export { OPS, MAX_LINE, lineBody, parseChanges, grammarHeads } from './capture/lines.js';
export { HIDDEN_MARKER, hasHidden, markOff, markCaps, capsOf, cutLine, withoutReasoning, defangMarker, continuation } from './capture/blocks.js';
export { assistSections, withAssist, sameChangeLine } from './capture/echo.js';
export { LEGACY_PROBLEM, hasLegacy, stripLegacy, adoptLegacy, legacyRead } from './capture/legacy.js';
export { STRAY_PARAGRAPHS, strayLines } from './capture/stray.js';
