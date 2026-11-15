// Story Suite v2: the registry's definition checks (moved out of registry.js unchanged; registry.js re-exports the public ones):
// the naming and shape rules, `definitionProblems` (what refuses a module) and `definitionWarnings` (what is only logged), the
// version a definition needs, and the capture heads and grammar a definition declares. Pure: no DOM, no SillyTavern, no state.
// Public face: re-exports its parts.

export { CAPTURE_PREFIX, INIT_PREFIX, HOST_MODULE, STANDARD_PREFIX } from './registry-checks-parts/names.js';
export { RESTORE_STATES, SETTINGS_PLACES, placeOf, MAX_CAPABILITIES } from './registry-checks-parts/lists.js';
export { FIELD_TYPES, normalizeField } from './registry-checks-parts/fields.js';
export { isObject, byId, jsonProblem } from './registry-checks-parts/shared-basics.js';
export { definitionProblems } from './registry-checks-parts/problems.js';
export { definitionWarnings } from './registry-checks-parts/warnings.js';
export { neededVersion } from './registry-checks-parts/version.js';
export { headsOf, grammarOf } from './registry-checks-parts/capture-heads.js';
