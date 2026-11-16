/* NPC State Delta scanner criteria and rubric compaction: default relationship/impact/memory/behavior criteria,
   rolling-relationship stripping, full-window payload preparation, prompt-name flattening and rubric compaction.
   Split from core-prompts.js without change; core-prompts.js re-exports every name it exported before.
   Public face: re-exports its parts. */
export { DEFAULT_RELATIONSHIP_CRITERIA, DEFAULT_IMPACT_CRITERIA, LEGACY_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA } from './core-prompts-criteria-parts/default-criteria.js';
export { DEFAULT_BEHAVIOR_CRITERIA } from './core-prompts-criteria-parts/behavior-criteria.js';
export { prepareFullWindowRelationshipPayload } from './core-prompts-criteria-parts/relationship-payload.js';
export { PROMPT_NAME_MAX, flatPromptName } from './core-prompts-criteria-parts/prompt-name.js';
export { compactRelationshipRubric, compactImpactRubric, compactMemoryRubric } from './core-prompts-criteria-parts/rubric-compact.js';
