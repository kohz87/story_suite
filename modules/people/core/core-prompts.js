/* NPC State scanner prompt facade: implementation split across core-prompts-criteria.js, core-prompts-relationship.js,
   core-prompts-select.js, core-prompts-targeted.js, core-prompts-capture.js and core-prompts-scanner.js. This module keeps
   its original path and re-exports every public name unchanged. The field lists come from fields/registry.js in the parts that use them
   (core-prompts-scanner.js, core-prompts-targeted-parts/prompt-shared.js). */
export { DEFAULT_RELATIONSHIP_CRITERIA, DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_BEHAVIOR_CRITERIA, prepareFullWindowRelationshipPayload, PROMPT_NAME_MAX, flatPromptName } from './core-prompts-criteria.js';
export { buildRelationshipPassPrompt } from './core-prompts-relationship.js';
export { scenePresentFocus, withScenePresent, selectScannerContextNpcs } from './core-prompts-select.js';
export { PROMPT_CAPS, returnShape, buildBackfillPrompt, buildDossierImportPrompt, STALE_PROFILE_TURNS, STALE_PROFILE_DAYS, buildProfileRefreshPrompt } from './core-prompts-targeted.js';
export { hiddenNotePromptRules, appendHiddenNotePrompt } from './core-prompts-capture.js';
export { buildScannerPrompt } from './core-prompts-scanner.js';
