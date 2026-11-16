// The read-only data-module views (moved out of data-modules/part.js unchanged): domain checks,
// module lookup and values, pinned screens, grammar, replay witnesses and the guard check.
// Public face: re-exports its parts.
export { validateDomain } from './views-parts/domain-check.js';
export { resolveModule, moduleView, pinnedPresentation } from './views-parts/lookup.js';
export { grammarFor } from './views-parts/grammar.js';
export { replayInputs, dataModuleGuard } from './views-parts/replay.js';
