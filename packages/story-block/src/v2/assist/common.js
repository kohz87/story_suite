// What both assist helpers share (docs/v2/SPEC.md §0.5, §4.5): their settings, a time limit for a
// model call, a short stable hash for keys, and the small run log `assist.status` reports. Pure: no
// DOM, no SillyTavern, no clock in state (the log counts runs, it does not time them).
// Public face: re-exports its parts.

export { SETTING, DEFAULTS, FEATURE_TEXT, SCHEMA } from './common-parts/settings.js';
export { TIMEOUT_MS, BACKGROUND, normalizeType } from './common-parts/limits.js';
export { estimateTokens, hashText, clip } from './common-parts/text-tools.js';
export { AssistTimeout, withTimeout } from './common-parts/timeout.js';
export { createRunLog } from './common-parts/run-log.js';
