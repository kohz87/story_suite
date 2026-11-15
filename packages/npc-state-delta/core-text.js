/* NPC State Delta scan text and JSON helpers: evidence extraction and stripping, scanner JSON repair and parsing,
   narration-capture reading, and the clean* text helpers. A pure part of core-mechanics.js (same owner, moved
   without change); core-mechanics.js re-exports every name it exported before. Imports nothing, so it never forms a cycle. Public face: re-exports its parts. */
export { normalizeName, cleanText, cleanTextBoundary, cleanList } from './core-text-parts/clean.js';
export { cleanWords, cleanWordsList } from './core-text-parts/clean-words.js';
export { stripMessageCitations } from './core-text-parts/citations.js';
export { normaliseScanKeys, parseScanJson } from './core-text-parts/scan-json.js';
export { extractNarrationCapture, parseNarrationCapture } from './core-text-parts/capture.js';
export { hasCompactMeguminWorldState, stripUiNoise, storyProse } from './core-text-parts/ui-evidence.js';
