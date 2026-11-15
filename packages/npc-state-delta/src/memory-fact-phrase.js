// Memory facts (design MEMDESIGN2 §8, §9): the model's chance to phrase a fallback, inside a call that already runs (auto/full scan; no new call,
// retry or timer). A handle names one pending fact; the dynamic paragraph lists, per handle, the closed set of allowed sentences; the model answers
// with an optional top-level `mem` { "h1": "sentence" }. A sentence is taken only when it equals an allowed production and the handle is still
// current at commit (same chat state, text, revision, pin/lock state, attempt and proven prompt window). One-pass capture sends NO handles
// (its window cannot be proven), so core-prompts-capture stays byte-identical. With no pending fact nothing is added to any prompt.
// Public face: re-exports its parts.
export { MAX_HANDLES, MAX_ATTEMPTS, PARAGRAPH_BYTES } from './memory-fact-phrase-parts/limits.js';
export { selectHandles } from './memory-fact-phrase-parts/handles.js';
export { memoryParagraph } from './memory-fact-phrase-parts/paragraph.js';
export { applyPhrasing } from './memory-fact-phrase-parts/apply.js';
