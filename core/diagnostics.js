// Settings → Diagnostics: one plain-text report a reader copies or saves for a bug report.
//
// What it holds: the versions (SillyTavern, Story Block, each module), the features that are on, each
// module's settings, the prompt size panel's numbers and the context size, the last 20 Problems, how
// saving is going, the chat's reply and record counts and its size, the recent Story Suite errors
// from the console (when they were caught), and each module's own section (its optional
// `hooks.diagnostics()`, MODULES §F118).
//
// What it never holds: API keys, tokens, passwords, addresses and other secrets (a settings key that
// names one is left out, and a value that looks like one is replaced), and no chat text: no message is
// read for its words, Problems are listed by code, module and reply (their messages name what the
// story wrote), and quoted text in an error line is replaced by its length. The
// reader sees the whole report before copying it.
//
// Pure apart from `captureConsole` (wraps console.error once) and `noteSaveError`: the report is built
// from a `source` the settings host gives (ui-host.js).
// Public face: re-exports its parts.
export { PROBLEMS_SHOWN, ERRORS_KEPT, HOOK_TIMEOUT_MS } from './diagnostics-parts/limits.js';
export { isSecretKey, REMOVED, scrubSecrets, scrubLine } from './diagnostics-parts/secrets.js';
export { scrubSettings } from './diagnostics-parts/scrub-settings.js';
export { noteError, noteSaveError } from './diagnostics-parts/notes.js';
export { captureConsole } from './diagnostics-parts/console-capture.js';
export { caughtSoFar, resetCaught } from './diagnostics-parts/caught-view.js';
export { chatCounts } from './diagnostics-parts/chat-counts.js';
export { callsLine } from './diagnostics-parts/calls-line.js';
export { buildReport } from './diagnostics-parts/build-report.js';
export { reportFileName } from './diagnostics-parts/report-file-name.js';
